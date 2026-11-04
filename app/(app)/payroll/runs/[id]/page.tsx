import { notFound } from "next/navigation";
import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, isoDate, recomputeRun, toGroupRules, toRules } from "@/lib/payroll/server";
import { conversionsForRun, leaveForRun } from "@/lib/payroll/leaveServer";
import type { DayHours, DayType } from "@/lib/payroll/compute";
import type { RunLeave } from "@/lib/payroll/leave";
import { RunEditor } from "./RunEditor";
import { ThirteenthRun } from "./ThirteenthRun";

export default async function PayrollRunPage({ params }: { params: { id: string } }) {
  const company = await getCurrentCompany();
  if (!company) notFound();
  const capability = await getCurrentCapability();
  // A draft 13th-month run reflects the latest posted runs every time it's opened.
  const head = await prisma.payrollRun.findFirst({ where: { id: params.id, companyId: company.id }, select: { kind: true, status: true } });
  if (head?.kind === "THIRTEENTH_MONTH" && head.status === "DRAFT") await recomputeRun(company.id, params.id);
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.id, companyId: company.id },
    include: { payGroup: true, lines: { include: { employee: { include: { payrollProfile: true } } } } },
  });
  if (!run) notFound();

  const setup = await getOrCreateSetup(company.id);
  const inRun = run.lines.map((l) => l.employeeId);
  const [items, available, branch] = await Promise.all([
    prisma.payItem.findMany({ where: { companyId: company.id }, orderBy: [{ kind: "asc" }, { code: "asc" }] }),
    prisma.payrollProfile.findMany({
      where: { companyId: company.id, payGroupId: run.payGroupId, isActive: true, employeeId: { notIn: inRun } },
      include: { employee: { select: { code: true, lastName: true, firstName: true } } },
    }),
    run.locationId ? prisma.location.findUnique({ where: { id: run.locationId }, select: { name: true } }) : null,
  ]);
  // Drafts show the leave that's approved right now (saving stores it on the
  // line); posted runs show what was paid.
  const liveLeaves = run.status === "DRAFT" ? await leaveForRun(company.id, inRun, isoDate(run.periodStart), isoDate(run.periodEnd)) : null;
  const liveConversions = run.status === "DRAFT" ? await conversionsForRun(company.id, inRun, isoDate(run.periodStart), isoDate(run.periodEnd)) : null;
  const num = (v: unknown) => Number(v);
  // What's left of each employee's yearly 13th-month/bonus exemption, from their other posted runs this year.
  const year = run.payDate.getUTCFullYear();
  const usedExempt = await prisma.payrollRunLine.groupBy({
    by: ["employeeId"],
    where: { employeeId: { in: inRun }, run: { companyId: company.id, status: "POSTED", id: { not: run.id }, payDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } } },
    _sum: { exemptBenefits: true },
  });
  const exemptLeft = (employeeId: string) => num(setup.benefitsExemptCap) - num(usedExempt.find((u) => u.employeeId === employeeId)?._sum.exemptBenefits ?? 0);

  if (run.kind === "THIRTEENTH_MONTH") {
    return (
      <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-8 sm:py-10">
        <ThirteenthRun
          companyId={company.id}
          canEdit={Boolean(capability?.canPost) && run.status === "DRAFT"}
          canCancel={Boolean(capability?.canCancel) && run.status === "POSTED"}
          run={{ id: run.id, runNo: run.runNo, status: run.status, groupName: run.payGroup.name, branch: branch?.name ?? null, year: run.periodStart.getUTCFullYear(), payDate: isoDate(run.payDate), cap: num(setup.benefitsExemptCap) }}
          lines={run.lines
            .map((l) => ({
              employeeId: l.employeeId, code: l.employee.code, name: `${l.employee.lastName}, ${l.employee.firstName}`,
              basis: num(l.thirteenthMonthBasis), pay: num(l.thirteenthMonthPay), exempt: num(l.exemptBenefits), taxable: num(l.taxableIncome),
              tax: num(l.withholdingTax), net: num(l.netPay),
            }))
            .sort((a, b) => a.name.localeCompare(b.name))}
        />
      </main>
    );
  }
  const lines = run.lines
    .map((l) => ({
      employeeId: l.employeeId,
      code: l.employee.code,
      name: `${l.employee.lastName}, ${l.employee.firstName}`,
      position: l.employee.position,
      payBasis: l.payBasis,
      rate: num(l.rate),
      isMinimumWage: l.employee.payrollProfile?.isMinimumWage ?? false,
      attendance: (l.attendance ?? {}) as Record<string, number>,
      absentDays: num(l.absentDays),
      lateMinutes: num(l.lateMinutes),
      otHours: num(l.otHours),
      nightDiffHours: num(l.nightDiffHours),
      adjustments: (Array.isArray(l.adjustments) ? l.adjustments : []) as { payItemId: string; amount: number }[],
      leaves: liveLeaves ? liveLeaves.get(l.employeeId) ?? [] : ((Array.isArray(l.leaves) ? l.leaves : []) as RunLeave[]),
      dayHours: (l.dayHours ?? {}) as Record<string, DayHours>,
      leaveConversionDays: liveConversions ? liveConversions.get(l.employeeId) ?? 0 : num(l.leaveConversionDays),
      benefitsExemptRemaining: exemptLeft(l.employeeId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-8 sm:py-10">
      <RunEditor
        companyId={company.id}
        canEdit={Boolean(capability?.canPost) && run.status === "DRAFT"}
        canCancel={Boolean(capability?.canCancel) && run.status === "POSTED"}
        run={{
          id: run.id, runNo: run.runNo, status: run.status, groupName: run.payGroup.name, branch: branch?.name ?? null,
          periodStart: isoDate(run.periodStart), periodEnd: isoDate(run.periodEnd), payDate: isoDate(run.payDate), remarks: run.remarks ?? "",
          dayTypes: (run.dayTypes ?? {}) as Record<string, DayType>,
        }}
        rules={toRules(setup)}
        group={toGroupRules(run.payGroup)}
        items={items.map((i) => ({ id: i.id, code: i.code, name: i.name, kind: i.kind, taxable: i.taxable, isOtherBenefit: i.isOtherBenefit, isActive: i.isActive }))}
        lines={lines}
        available={available.map((p) => ({ employeeId: p.employeeId, label: `${p.employee.lastName}, ${p.employee.firstName} (${p.employee.code})` }))}
      />
    </main>
  );
}
