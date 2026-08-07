import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { recomputeCompanySubscriptionSummary } from "@/lib/subscriptionCoverage";

function addOneMonth(d: Date): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + 1);
  return out;
}

// Admin verifies or rejects a pending subscription payment. Rejecting
// restores a used voucher. Verifying uses whichever month the subscriber
// chose when they submitted the payment (periodStart/periodEnd, set by
// POST /api/subscription/pay) — it does NOT re-derive a rolling "extend
// from now" period, since that would silently override what they actually
// paid for. Falls back to the old rolling computation only for a payment
// that predates that field being set at submission time.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== "VERIFIED" && status !== "REJECTED") {
    return NextResponse.json({ error: "status must be VERIFIED or REJECTED." }, { status: 400 });
  }

  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (payment.status !== "PENDING") {
    return NextResponse.json({ error: `This payment is already ${payment.status.toLowerCase()}.` }, { status: 400 });
  }

  // Suppress auto-audit during the transaction — the extension's out-of-band
  // audit write deadlocks the transaction on the connection-limited pooler.
  setAuditSuppressed(true);
  try {
    if (status === "VERIFIED") {
      let periodStart = payment.periodStart;
      let periodEnd = payment.periodEnd;
      if (!periodStart || !periodEnd) {
        // Legacy payment with no chosen month — extend from the later of
        // today or the company's current end, so paying early stacks.
        const company = await prisma.company.findUnique({
          where: { id: payment.companyId },
          select: { subscriptionEndsAt: true },
        });
        const now = new Date();
        const currentEnd = company?.subscriptionEndsAt ? new Date(company.subscriptionEndsAt) : null;
        periodStart = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
        periodEnd = addOneMonth(periodStart);
      }

      const result = await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: "VERIFIED", verifiedById: admin.id, verifiedAt: new Date(), periodStart, periodEnd },
      });
      // Outside the transaction implicit in the single update above — this
      // is its own statement, matching the pattern used by the admin
      // renewals route (avoids a second connection contending with one
      // already held, which deadlocks on the pooler).
      await recomputeCompanySubscriptionSummary(payment.companyId);
      return NextResponse.json({ payment: result });
    }

    // REJECTED — free the voucher back up if one was used.
    const result = await prisma.$transaction(async (tx) => {
      if (payment.voucherCode) {
        await tx.voucher.updateMany({
          where: { code: payment.voucherCode },
          data: { redeemedAt: null, redeemedByCompanyId: null, isActive: true },
        });
      }
      return tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: "REJECTED", verifiedById: admin.id, verifiedAt: new Date() },
      });
    });
    return NextResponse.json({ payment: result });
  } finally {
    setAuditSuppressed(false);
  }
}
