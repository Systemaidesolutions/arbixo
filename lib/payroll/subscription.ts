import { prisma } from "@/lib/prisma";
import { coverageProblem, monthKey, runMonths } from "./subscriptionTiers";

// ARbixo Payroll is its own monthly subscription (SubscriptionPayment.app =
// PAYROLL), priced by employee tier. A payroll run can only be created,
// edited or posted for months the company has a VERIFIED payroll payment for,
// and only while its active payroll employees fit that month's tier.
// Admins acting inside a company bypass this, like the accounting check.

/** Month key → highest employee tier paid for that month. */
export async function getPayrollCoverage(companyId: string): Promise<Map<number, number>> {
  const payments = await prisma.subscriptionPayment.findMany({
    where: { companyId, app: "PAYROLL", status: "VERIFIED", periodStart: { not: null }, periodEnd: { not: null } },
    select: { periodStart: true, periodEnd: true, maxEmployees: true },
  });
  const out = new Map<number, number>();
  for (const p of payments) {
    const last = monthKey(new Date(p.periodEnd!.getTime() - 1)); // periodEnd is exclusive
    for (let k = monthKey(p.periodStart!); k <= last; k++) out.set(k, Math.max(out.get(k) ?? 0, p.maxEmployees ?? 0));
  }
  return out;
}

/** Employees counted against the tier: payroll profile active ("Include in payroll") and employee active. */
export function activePayrollEmployees(companyId: string): Promise<number> {
  return prisma.payrollProfile.count({ where: { companyId, isActive: true, employee: { isActive: true } } });
}

/** Null when the run's months are paid for its employee count, else the message to show. */
export async function payrollSubscriptionProblem(
  companyId: string,
  run: { kind: string; periodStart: Date; periodEnd: Date; payDate: Date },
): Promise<string | null> {
  const [coverage, count] = await Promise.all([getPayrollCoverage(companyId), activePayrollEmployees(companyId)]);
  return coverageProblem(coverage, runMonths(run), count);
}
