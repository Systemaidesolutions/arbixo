import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { getCurrentPrice } from "@/lib/subscriptionPricing";
import { voucherDiscount, voucherStatus } from "@/lib/vouchers";
import { setAuditSuppressed } from "@/lib/auditContext";
import { monthStringToPeriod, recomputeCompanySubscriptionSummary } from "@/lib/subscriptionCoverage";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
    prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { gcashName: true, gcashNumber: true, gcashQrImage: true } }),
  ]);

  return NextResponse.json({
    companies,
    price: price ? { name: price.name, amount: Number(price.amount), currency: price.currency } : null,
    gcash: { name: settings?.gcashName ?? "", number: settings?.gcashNumber ?? "", qrImage: settings?.gcashQrImage ?? null },
  });
}

// Admin records a company's subscription payment for a specific calendar
// month (picked in the UI, "YYYY-MM") at the current price, VERIFIED
// immediately since the admin is the authority. Redeems a voucher if
// supplied. Company.subscriptionStartedAt/EndsAt are then recomputed from
// the full VERIFIED payment history, so paying for an out-of-order month
// (e.g. backfilling one before the current span) still widens the summary
// correctly instead of only ever rolling forward.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const companyId = typeof body?.companyId === "string" ? body.companyId : "";
  const code = typeof body?.voucherCode === "string" ? body.voucherCode.trim().toUpperCase() : "";
  const gcashRef = typeof body?.gcashRef === "string" ? body.gcashRef.trim() : "";
  if (!companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });

  // Cancel: clear the subscription so it reads as "none". Plain update (no
  // transaction), so no audit-suppression is needed.
  if (body?.action === "cancel") {
    const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    await prisma.company.update({ where: { id: companyId }, data: { subscriptionEndsAt: null } });
    return NextResponse.json({ ok: true, subscriptionEndsAt: null });
  }

  const month = typeof body?.month === "string" ? body.month : "";
  let periodStart: Date, periodEnd: Date;
  try {
    ({ periodStart, periodEnd } = monthStringToPeriod(month));
  } catch {
    return NextResponse.json({ error: "A valid month (YYYY-MM) is required." }, { status: 400 });
  }

  const [price, company] = await Promise.all([
    getCurrentPrice(),
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }),
  ]);
  if (!price) return NextResponse.json({ error: "No subscription price is set." }, { status: 400 });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const base = Number(price.amount);
  const now = new Date();

  // Suppress auto-audit during the transaction: the extension's out-of-band
  // audit write needs a second DB connection, which deadlocks against the
  // transaction on the connection-limited production pooler. The
  // SubscriptionPayment row is itself the record of this action.
  setAuditSuppressed(true);
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
    // Outside the transaction — recomputing after it commits avoids a second
    // connection contending with the one the transaction is still holding.
    await recomputeCompanySubscriptionSummary(companyId);
    const updated = await prisma.company.findUnique({ where: { id: companyId }, select: { subscriptionEndsAt: true } });
    return NextResponse.json({ ok: true, subscriptionEndsAt: updated?.subscriptionEndsAt ?? periodEnd });
  } catch (err) {
    if (err instanceof VoucherError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[admin renew] failed:", err);
    return NextResponse.json({ error: "Could not renew." }, { status: 500 });
  } finally {
    setAuditSuppressed(false);
  }
}
