import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payrollAuth, getOrCreateSetup } from "@/lib/payroll/server";
import { employeeBalances } from "@/lib/payroll/leaveServer";
import { isLocked } from "@/lib/leavePortalRules";

// One employee's leave settings, shown on the shared Employees edit form:
// credit earning (monthly / Jan 1 / company default), this year's balances,
// and their leave-portal PIN status. Payroll staff only.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const emp = await prisma.employee.findFirst({
    where: { id: params.id, companyId: auth.companyId },
    select: {
      id: true, portalPinSetAt: true, portalLockedUntil: true,
      payrollProfile: { select: { leaveMonthlyAccrual: true } },
      company: { select: { leavePortalEnabled: true } },
    },
  });
  if (!emp) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const now = new Date();
  const year = now.getUTCFullYear();
  const [setup, balances] = await Promise.all([
    getOrCreateSetup(auth.companyId),
    emp.payrollProfile ? employeeBalances(auth.companyId, emp.id, year, now) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    hasProfile: !!emp.payrollProfile,
    leaveMonthlyAccrual: emp.payrollProfile?.leaveMonthlyAccrual ?? null,
    companyMonthly: setup.leaveMonthlyAccrual,
    year,
    balances,
    portalEnabled: emp.company.leavePortalEnabled,
    pin: { hasPin: !!emp.portalPinSetAt, setAt: emp.portalPinSetAt, locked: isLocked(emp.portalLockedUntil) },
  });
}

// Body: { leaveMonthlyAccrual: true | false | null } (null = company setting).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const v = body?.leaveMonthlyAccrual;
  if (!(v === true || v === false || v === null)) return NextResponse.json({ error: "Choose how leave credits are earned." }, { status: 400 });

  const profile = await prisma.payrollProfile.findFirst({ where: { employeeId: params.id, companyId: auth.companyId }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Set up this employee's pay details under Payroll employees first." }, { status: 400 });
  }
  await prisma.payrollProfile.update({ where: { id: profile.id }, data: { leaveMonthlyAccrual: v } });
  return NextResponse.json({ ok: true });
}
