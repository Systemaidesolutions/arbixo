import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup } from "@/lib/payroll/server";
import { TimesheetClient } from "./TimesheetClient";

export default async function TimesheetsPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Timesheets</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const setup = await getOrCreateSetup(company.id);
  const [profiles, groups, branches] = await Promise.all([
    prisma.payrollProfile.findMany({
      where: { companyId: company.id, isActive: true, employee: { isActive: true } },
      include: { employee: { select: { code: true, lastName: true, firstName: true, position: true } } },
    }),
    prisma.payGroup.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, frequency: true, weekStartDay: true } }),
    prisma.location.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const employees = profiles
    .map((p) => ({
      id: p.employeeId,
      code: p.employee.code,
      name: `${p.employee.lastName}, ${p.employee.firstName}`,
      position: p.employee.position,
      payBasis: p.payBasis,
      groupId: p.payGroupId,
      locationId: p.locationId,
      shiftStart: p.shiftStart,
      shiftEnd: p.shiftEnd,
      // Weekdays this employee rests on (empty when their rest days vary).
      restWeekdays: p.restDayMode === "FLEXIBLE" ? [] : p.restWeekdays.length ? p.restWeekdays : setup.restWeekdays,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-xl font-medium text-neutral-900">Timesheets</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500">
        Encode each employee&apos;s daily time here. The timesheet is the basis of the payroll run: a new run starts with the period&apos;s days worked,
        late/undertime, overtime and night hours already filled in, and a draft run can be refreshed from it with <b>Fill from timesheets</b>.
      </p>
      <div className="mt-5">
        <TimesheetClient
          canEdit={Boolean(capability?.canPost)}
          employees={employees}
          groups={groups}
          branches={branches}
          shift={{
            start: setup.shiftStart, end: setup.shiftEnd, breakMinutes: setup.breakMinutes, lateGraceMinutes: setup.lateGraceMinutes,
            otMinimumMinutes: setup.otMinimumMinutes, otRoundingMinutes: setup.otRoundingMinutes,
          }}
        />
      </div>
    </main>
  );
}
