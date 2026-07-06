import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { getCurrentPrice } from "@/lib/subscriptionPricing";
import { voucherDiscount, voucherStatus } from "@/lib/vouchers";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function addOneMonth(d: Date): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + 1);
  return out;
}
class VoucherError extends Error {}

// List: all companies with their subscription end, plus the current price and
// GCash account (for the renew panel).
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const [companies, price, settings] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, tradeName: true, registeredName: true, subscriptionEndsAt: true },
      orderBy: { tradeName: "asc" },
    }),
    getCurrentPrice(),
    prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { gcashName: true, gcashNumber: true } }),
  ]);

  return NextResponse.json({
    companies,
    price: price ? { name: price.name, amount: Number(price.amount), currency: price.currency } : null,
    gcash: { name: settings?.gcashName ?? "", number: settings?.gcashNumber ?? "" },
  });
}

// Admin renews a company: extends the subscription by one month at the current
// price and records a VERIFIED payment (admin is the authority, so no separate
// verification step). Redeems a voucher if supplied.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const companyId = typeof body?.companyId === "string" ? body.companyId : "";
  const code = typeof body?.voucherCode === "string" ? body.voucherCode.trim().toUpperCase() : "";
  const gcashRef = typeof body?.gcashRef === "string" ? body.gcashRef.trim() : "";
  if (!companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });

  const [price, company] = await Promise.all([
    getCurrentPrice(),
    prisma.company.findUnique({ where: { id: companyId }, select: { subscriptionEndsAt: true, subscriptionStartedAt: true } }),
  ]);
  if (!price) return NextResponse.json({ error: "No subscription price is set." }, { status: 400 });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const base = Number(price.amount);
  const now = new Date();
  const currentEnd = company.subscriptionEndsAt ? new Date(company.subscriptionEndsAt) : null;
  const periodStart = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const periodEnd = addOneMonth(periodStart);

  try {
    await prisma.$transaction(async (tx) => {
      let discount = 0;
      let voucherCode: string | null = null;
      if (code) {
        const v = await tx.voucher.findUnique({ where: { code } });
        if (!v || voucherStatus(v) !== "active") throw new VoucherError("That voucher isn't valid or has already been used.");
        discount = voucherDiscount(v, base);
        voucherCode = v.code;
        await tx.voucher.update({ where: { id: v.id }, data: { redeemedAt: now, redeemedByCompanyId: companyId } });
      }
      await tx.company.update({
        where: { id: companyId },
        data: { subscriptionEndsAt: periodEnd, subscriptionStartedAt: company.subscriptionStartedAt ?? now },
      });
      await tx.subscriptionPayment.create({
        data: {
          companyId,
          priceName: price.name,
          baseAmount: base,
          currency: price.currency,
          voucherCode,
          discountAmount: discount,
          amountDue: round2(base - discount),
          gcashRef: gcashRef || null,
          status: "VERIFIED",
          createdById: admin.id,
          createdByEmail: admin.email,
          verifiedById: admin.id,
          verifiedAt: now,
          periodStart,
          periodEnd,
        },
      });
    });
    return NextResponse.json({ ok: true, subscriptionEndsAt: periodEnd });
  } catch (err) {
    if (err instanceof VoucherError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[admin renew] failed:", err);
    return NextResponse.json({ error: "Could not renew." }, { status: 500 });
  }
}
