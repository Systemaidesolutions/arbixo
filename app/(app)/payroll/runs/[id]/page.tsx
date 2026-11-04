import { notFound } from "next/navigation";
import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, isoDate, toGroupRules, toRules } from "@/lib/payroll/server";
import { leaveForRun } from "@/lib/payroll/leaveServer";
import type { DayType } from "@/lib/payroll/compute";
import type { RunLeave } from "@/lib/payroll/leave";
import { RunEditor } from "./RunEditor";

export default async function PayrollRunPage({ params }: { params: { id: string } }) {
  const company = await getCurrentCompany();
  if (!company) notFound();
  const capability = await getCurrentCapability();
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
  const num = (v: unknown) => Number(v);
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
        items={items.map((i) => ({ id: i.id, code: i.code, name: i.name, kind: i.kind, taxable: i.taxable, isActive: i.isActive }))}
        lines={lines}
        available={available.map((p) => ({ employeeId: p.employeeId, label: `${p.employee.lastName}, ${p.employee.firstName} (${p.employee.code})` }))}
      />
    </main>
  );
}
