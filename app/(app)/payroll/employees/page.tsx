import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, isoDate } from "@/lib/payroll/server";
import { PayrollEmployeesClient } from "./PayrollEmployeesClient";

export default async function PayrollEmployeesPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Payroll employees</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const setup = await getOrCreateSetup(company.id);
  const [employees, groups, items, branches] = await Promise.all([
    prisma.employee.findMany({ where: { companyId: company.id }, include: { payrollProfile: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.payGroup.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.payItem.findMany({ where: { companyId: company.id, isActive: true }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true, kind: true } }),
    prisma.location.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Payroll employees</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pay details for each employee: pay group, monthly or daily rate, government numbers and recurring items. Add new people under{" "}
        <a href="/payroll/employee-records" className="text-brand-blue hover:underline">Setup › Employees</a> first.
      </p>
      <div className="mt-6">
        <PayrollEmployeesClient
          canEdit={Boolean(capability?.canPost)}
          companyRestWeekdays={setup.restWeekdays}
          companyLeaveMonthly={setup.leaveMonthlyAccrual}
          groups={groups}
          items={items}
          branches={branches}
          employees={employees.map((e) => {
            const p = e.payrollProfile;
            return {
              id: e.id, code: e.code, name: `${e.lastName}, ${e.firstName}${e.middleName ? ` ${e.middleName.charAt(0)}.` : ""}`,
              position: e.position, isActive: e.isActive,
              profile: p ? {
                payGroupId: p.payGroupId, locationId: p.locationId, employmentType: p.employmentType, payBasis: p.payBasis, rate: Number(p.rate),
                hireDate: p.hireDate ? isoDate(p.hireDate) : "", contractEnd: p.contractEnd ? isoDate(p.contractEnd) : "",
                sssNo: p.sssNo ?? "", philhealthNo: p.philhealthNo ?? "", pagibigNo: p.pagibigNo ?? "", isMinimumWage: p.isMinimumWage,
                deductSss: p.deductSss, deductPhilhealth: p.deductPhilhealth, deductHdmf: p.deductHdmf, withholdTax: p.withholdTax,
                sex: p.sex, isSoloParent: p.isSoloParent, thirteenthMonthEligible: p.thirteenthMonthEligible,
                biometricId: p.biometricId ?? "", shiftStart: p.shiftStart ?? "", shiftEnd: p.shiftEnd ?? "",
                restDayMode: p.restDayMode, restWeekdays: p.restWeekdays, leaveMonthlyAccrual: p.leaveMonthlyAccrual,
                recurring: (Array.isArray(p.recurring) ? p.recurring : []) as { payItemId: string; amount: number }[],
                bankName: p.bankName ?? "", bankAccountNo: p.bankAccountNo ?? "", isActive: p.isActive,
              } : null,
            };
          })}
        />
      </div>
    </main>
  );
}
