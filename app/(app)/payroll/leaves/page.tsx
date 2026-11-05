import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, isoDate } from "@/lib/payroll/server";
import { ensureLeaveTypes } from "@/lib/payroll/leaveServer";
import { accruedCredits, daysByYear, effectiveAccrual, type LeaveDate } from "@/lib/payroll/leave";
import { LeavesClient, type Balance } from "./LeavesClient";

export default async function LeavesPage({ searchParams }: { searchParams: { year?: string; tab?: string } }) {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Leave</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const now = new Date();
  const thisYear = now.getFullYear();
  const year = Number(searchParams.year) >= 2000 && Number(searchParams.year) <= 2100 ? Number(searchParams.year) : thisYear;
  const tab = searchParams.tab === "balances" ? "balances" : "filings";

  const [setup] = await Promise.all([getOrCreateSetup(company.id), ensureLeaveTypes(company.id)]);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const [types, profiles, requests, credits] = await Promise.all([
    prisma.leaveType.findMany({ where: { companyId: company.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.payrollProfile.findMany({
      where: { companyId: company.id, employee: { isActive: true } },
      include: { employee: { select: { code: true, lastName: true, firstName: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: { companyId: company.id, startDate: { lte: yearEnd }, endDate: { gte: yearStart } },
      include: { employee: { select: { code: true, lastName: true, firstName: true } }, leaveType: { select: { code: true, name: true } } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.leaveCredit.findMany({ where: { companyId: company.id, year } }),
  ]);

  // Days used (pending + approved) per employee and leave type in this year.
  const used = new Map<string, number>();
  for (const r of requests) {
    if (r.status !== "PENDING" && r.status !== "APPROVED") continue;
    const d = daysByYear(r.dates as LeaveDate[]).get(year) ?? 0;
    const k = `${r.employeeId}:${r.leaveTypeId}`;
    used.set(k, (used.get(k) ?? 0) + d);
  }
  const throughMonth = year < thisYear ? 12 : year === thisYear ? now.getMonth() + 1 : 0;
  const balances: Balance[] = [];
  for (const t of types.filter((x) => x.creditBasis === "ANNUAL")) {
    for (const p of profiles) {
      const c = credits.find((x) => x.employeeId === p.employeeId && x.leaveTypeId === t.id);
      const u = used.get(`${p.employeeId}:${t.id}`) ?? 0;
      if (!c && !u) continue;
      const granted = Number(c?.granted ?? 0), carriedOver = Number(c?.carriedOver ?? 0), adjustment = Number(c?.adjustment ?? 0);
      const total = accruedCredits(granted, effectiveAccrual(t.accrual, setup.leaveMonthlyAccrual, p.leaveMonthlyAccrual), throughMonth) + carriedOver + adjustment;
      balances.push({ employeeId: p.employeeId, leaveTypeId: t.id, granted, carriedOver, adjustment, earned: total, used: Math.round(u * 100) / 100 });
    }
  }

  const name = (e: { lastName: string; firstName: string }) => `${e.lastName}, ${e.firstName}`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Leave</h1>
      <p className="mt-1 text-sm text-neutral-500">
        File and approve leave, and track each employee&apos;s credits. Approved leave goes into draft payroll runs automatically: paid leave is paid
        at the daily rate for daily-rate staff and isn&apos;t an absence for monthly-paid staff; leave without pay is deducted.
      </p>
      <div className="mt-6">
        <LeavesClient
          canEdit={Boolean(capability?.canPost)}
          tab={tab}
          year={year}
          restWeekdays={setup.restWeekdays}
          types={types.map((t) => ({
            id: t.id, code: t.code, name: t.name, isPaid: t.isPaid, isActive: t.isActive, creditBasis: t.creditBasis, days: Number(t.days),
            accrual: t.accrual, countCalendarDays: t.countCalendarDays, allowHalfDay: t.allowHalfDay, allowNegative: t.allowNegative,
            minServiceMonths: t.minServiceMonths, eligibility: t.eligibility, soloParentOnly: t.soloParentOnly, employmentTypes: t.employmentTypes,
            maxCarryOver: Number(t.maxCarryOver), convertibleToCash: t.convertibleToCash,
            soloParentExtraDays: Number(t.soloParentExtraDays), maxFilings: t.maxFilings, maxDaysPerYear: t.maxDaysPerYear == null ? null : Number(t.maxDaysPerYear),
          }))}
          employees={profiles
            .map((p) => ({
              id: p.employeeId, code: p.employee.code, name: name(p.employee), active: p.isActive,
              facts: { sex: p.sex, isSoloParent: p.isSoloParent, employmentType: p.employmentType, hireDate: p.hireDate ? isoDate(p.hireDate) : null },
            }))
            .sort((a, b) => a.name.localeCompare(b.name))}
          requests={requests.map((r) => ({
            id: r.id, employeeId: r.employeeId, employee: name(r.employee), code: r.leaveType.code, typeName: r.leaveType.name,
            startDate: isoDate(r.startDate), endDate: isoDate(r.endDate), days: Number(r.days), isPaid: r.isPaid, reason: r.reason ?? "", viaPortal: r.filedViaPortal,
            status: r.status, decisionNote: r.decisionNote ?? "", kind: r.kind,
          }))}
          balances={balances}
        />
      </div>
    </main>
  );
}
