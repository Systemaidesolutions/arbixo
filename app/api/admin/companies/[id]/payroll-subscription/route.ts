import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { getCurrentPrice } from "@/lib/subscriptionPricing";
import { monthStringToPeriod } from "@/lib/subscriptionCoverage";
import { isPayrollTier } from "@/lib/payroll/subscriptionTiers";
import { setAuditSuppressed } from "@/lib/auditContext";

// Admin › Companies › (company) › Payroll subscription.
// POST records a VERIFIED ARbixo Payroll payment for one month and employee
// tier, at that tier's current price, or as a free grant (₱0, e.g. a trial).
// DELETE voids a recorded payroll month (marks its payments REJECTED, so the
// history stays) — that month's payroll runs lock again.

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const tier = Number(body?.maxEmployees);
  const free = body?.free === true;
  let periodStart: Date, periodEnd: Date;
  try {
    ({ periodStart, periodEnd } = monthStringToPeriod(String(body?.month ?? "")));
  } catch {
    return NextResponse.json({ error: "Pick a month." }, { status: 400 });
  }
  if (!isPayrollTier(tier)) return NextResponse.json({ error: "Pick an employee tier." }, { status: 400 });
  const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const price = await getCurrentPrice(new Date(), "PAYROLL", tier);
  if (!price && !free) {
    return NextResponse.json({ error: `No ARbixo Payroll price is set for up to ${tier} employees. Add one under Subscription › Pricing, or tick Free grant.` }, { status: 400 });
  }
  const amount = free ? 0 : Number(price!.amount);

  setAuditSuppressed(true);
  try {
    await prisma.subscriptionPayment.create({
      data: {
        companyId: params.id,
        app: "PAYROLL",
        maxEmployees: tier,
        priceName: free ? `Payroll, up to ${tier} employees (free grant)` : `Payroll, up to ${tier} employees (${price!.name})`,
        baseAmount: amount,
        currency: price?.currency ?? "PHP",
        discountAmount: 0,
        amountDue: amount,
        status: "VERIFIED",
        createdById: admin.id,
        createdByEmail: admin.email,
        verifiedById: admin.id,
        verifiedAt: new Date(),
        periodStart,
        periodEnd,
      },
    });
  } finally {
    setAuditSuppressed(false);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  let periodStart: Date;
  try {
    ({ periodStart } = monthStringToPeriod(request.nextUrl.searchParams.get("month") ?? ""));
  } catch {
    return NextResponse.json({ error: "Pick a month." }, { status: 400 });
  }
  const r = await prisma.subscriptionPayment.updateMany({
    where: { companyId: params.id, app: "PAYROLL", status: "VERIFIED", periodStart },
    data: { status: "REJECTED", verifiedById: admin.id, verifiedAt: new Date() },
  });
  return NextResponse.json({ ok: true, removed: r.count });
}
