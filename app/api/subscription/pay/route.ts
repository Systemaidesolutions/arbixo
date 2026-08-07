import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { getCurrentPrice } from "@/lib/subscriptionPricing";
import { voucherDiscount, voucherStatus } from "@/lib/vouchers";
import { setAuditSuppressed } from "@/lib/auditContext";
import { monthStringToPeriod } from "@/lib/subscriptionCoverage";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

class VoucherError extends Error {}

// Matches the 2 MB raw-file cap enforced client-side in RenewClient.tsx —
// checked here as the base64 STRING length, which is ~4/3 the raw file size,
// so this threshold is the raw cap inflated by that ratio (plus slack for
// the "data:image/...;base64," prefix).
const MAX_RECEIPT_BASE64_LENGTH = 2_800_000;

// Records a subscription payment as PENDING for a specific month the
// subscriber chose (admin verifies later against the uploaded receipt). A
// voucher, if supplied, is redeemed here (single-use) inside the same
// transaction.
export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const companyId = await effectiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) {
    return NextResponse.json({ error: "Only a Manager can renew the subscription." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.voucherCode === "string" ? body.voucherCode.trim().toUpperCase() : "";
  const gcashRef = typeof body?.gcashRef === "string" ? body.gcashRef.trim() : "";
  const month = typeof body?.month === "string" ? body.month : "";
  const receiptImage = typeof body?.receiptImage === "string" ? body.receiptImage : "";

  let periodStart: Date, periodEnd: Date;
  try {
    ({ periodStart, periodEnd } = monthStringToPeriod(month));
  } catch {
    return NextResponse.json({ error: "Pick a valid month to pay for." }, { status: 400 });
  }
  if (receiptImage && receiptImage.length > MAX_RECEIPT_BASE64_LENGTH) {
    return NextResponse.json({ error: "Receipt image is too large (max ~2 MB)." }, { status: 400 });
  }

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
          receiptImage: receiptImage || null,
          status: "PENDING",
          periodStart,
          periodEnd,
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
