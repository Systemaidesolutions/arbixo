import { getCurrentCompany, getCurrentCapability, getCurrentUserRecord } from "@/lib/currentUser";
import { PayrollSubscriptionStatus } from "../SubscriptionStatus";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, isoDate } from "@/lib/payroll/server";
import { RunsClient } from "./RunsClient";

export default async function PayrollRunsPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Payroll runs</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  await getOrCreateSetup(company.id);
  const [runs, groups, branches] = await Promise.all([
    prisma.payrollRun.findMany({ where: { companyId: company.id }, include: { payGroup: true, _count: { select: { lines: true } } }, orderBy: [{ periodStart: "desc" }, { runNo: "desc" }], take: 200 }),
    prisma.payGroup.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, frequency: true, weekStartDay: true } }),
    prisma.location.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Payroll runs</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Create a run per pay group and period, encode attendance and adjustments, then post it to the General Journal.
      </p>
      <div className="mt-4">
        <PayrollSubscriptionStatus companyId={company.id} isAdmin={(await getCurrentUserRecord())?.role === "ADMIN"} />
      </div>
      <div className="mt-6">
        <RunsClient
          canEdit={Boolean(capability?.canPost)}
          groups={groups}
          branches={branches}
          runs={runs.map((r) => ({
            id: r.id, runNo: r.runNo, group: r.payGroup.name, periodStart: isoDate(r.periodStart), periodEnd: isoDate(r.periodEnd),
            payDate: isoDate(r.payDate), status: r.status, employees: r._count.lines, totalGross: Number(r.totalGross), totalNet: Number(r.totalNet),
            branch: branches.find((b) => b.id === r.locationId)?.name ?? null, kind: r.kind,
          }))}
        />
      </div>
    </main>
  );
}
