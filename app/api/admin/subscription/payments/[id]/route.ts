import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

function addOneMonth(d: Date): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + 1);
  return out;
}

// Admin verifies or rejects a pending subscription payment. Verifying extends
// the company's subscription by one month; rejecting restores a used voucher.
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

  const result = await prisma.$transaction(async (tx) => {
    if (status === "VERIFIED") {
      const company = await tx.company.findUnique({
        where: { id: payment.companyId },
        select: { subscriptionEndsAt: true, subscriptionStartedAt: true },
      });
      const now = new Date();
      const currentEnd = company?.subscriptionEndsAt ? new Date(company.subscriptionEndsAt) : null;
      // Extend from the later of today or the current end, so paying early stacks.
      const periodStart = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
      const periodEnd = addOneMonth(periodStart);

      await tx.company.update({
        where: { id: payment.companyId },
        data: {
          subscriptionEndsAt: periodEnd,
          subscriptionStartedAt: company?.subscriptionStartedAt ?? now,
        },
      });
      return tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: "VERIFIED", verifiedById: admin.id, verifiedAt: now, periodStart, periodEnd },
      });
    }

    // REJECTED — free the voucher back up if one was used.
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
}
