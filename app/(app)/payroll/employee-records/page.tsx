import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { PartyManager } from "../../agents/PartyManager";

export const dynamic = "force-dynamic";

// Payroll › Setup › Employees. Payroll's own copy of the employee master
// page, kept separate from Accounting's (/agents/employees) so payroll-only
// parts (the Leave section on the edit form, and anything added later) never
// show in Accounting. Both edit the same Employee records.
export default async function PayrollEmployeeRecordsPage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Employees</h1>
        <p className="mt-2 text-neutral-600">No company is set up yet. Complete company setup first.</p>
      </main>
    );
  }

  const items = await prisma.employee.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } });

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-1 text-xl font-medium text-neutral-900">Employees</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Employee details, plus each employee&apos;s leave credits and leave portal PIN (open an employee to edit). Pay details are under{" "}
        <a href="/payroll/employees" className="text-brand-blue hover:underline">Payroll employees</a>.
      </p>
      <PartyManager entityType="employee" companyId={company.id} initialItems={items} showLeave />
    </main>
  );
}
