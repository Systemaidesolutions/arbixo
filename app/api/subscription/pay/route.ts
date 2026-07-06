import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { getCurrentPrice } from "@/lib/subscriptionPricing";
import { voucherDiscount, voucherStatus } from "@/lib/vouchers";
import { setAuditSuppressed } from "@/lib/auditContext";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

class VoucherError extends Error {}

// Records a subscription payment as PENDING (admin verifies later). A voucher,
// if supplied, is redeemed here (single-use) inside the same transaction.
export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  if (!capabilitiesFor(user.role, user.subscriberSubtype).canApprove) {
    return NextResponse.json({ error: "Only a Manager can renew the subscription." }, { status: 403 });
  }
  const companyId = user.companyId;

  const body = await request.json().catch(() => null);
  const code = typeof body?.voucherCode === "string" ? body.voucherCode.trim().toUpperCase() : "";
  const gcashRef = typeof body?.gcashRef === "string" ? body.gcashRef.trim() : "";

  const price = await getCurrentPrice();
  if (!price) {
    return NextResponse.json({ error: "No subscription price is set. Contact your administrator." }, { status: 400 });
  }
  const base = Number(price.amount);

  // Suppress auto-audit during the transaction — see the note in the admin
  // renew route: the extension's out-of-band write deadlocks the transaction on
  // the connection-limited pooler.
  setAuditSuppressed(true);
  try {
    const payment = await prisma.$transaction(async (tx) => {
      let discount = 0;
      let voucherCode: string | null = null;
      if (code) {
        const v = await tx.voucher.findUnique({ where: { code } });
        if (!v || voucherStatus(v) !== "active") throw new VoucherError("That voucher isn't valid or has already been used.");
        discount = voucherDiscount(v, base);
        voucherCode = v.code;
        await tx.voucher.update({
          where: { id: v.id },
          data: { redeemedAt: new Date(), redeemedByCompanyId: companyId },
        });
      }
      const amountDue = round2(base - discount);
      return tx.subscriptionPayment.create({
        data: {
          companyId,
          priceName: price.name,
          baseAmount: base,
          currency: price.currency,
          voucherCode,
          discountAmount: discount,
          amountDue,
          gcashRef: gcashRef || null,
          status: "PENDING",
          createdById: user.id,
          createdByEmail: user.email,
        },
      });
    });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    if (err instanceof VoucherError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[subscription/pay] failed:", err);
    return NextResponse.json({ error: "Could not record the payment." }, { status: 500 });
  } finally {
    setAuditSuppressed(false);
  }
}
