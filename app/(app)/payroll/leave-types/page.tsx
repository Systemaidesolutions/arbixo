import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { ensureLeaveTypes } from "@/lib/payroll/leaveServer";
import { LeaveTypesClient } from "./LeaveTypesClient";

export default async function LeaveTypesPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Leave types</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  await ensureLeaveTypes(company.id);
  const types = await prisma.leaveType.findMany({ where: { companyId: company.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Leave types</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Starts with the Philippine statutory leaves as summarized in the DOLE Handbook on Workers&apos; Statutory Monetary Benefits (SIL, maternity,
        allocated maternity, paternity, solo parent, VAWC, special leave for women) plus vacation, sick and leave without pay. Adjust credits and eligibility to your company policy, or add your own (birthday, bereavement, emergency…).
      </p>
      <div className="mt-6">
        <LeaveTypesClient
          canEdit={Boolean(capability?.canPost)}
          types={types.map((t) => ({
            id: t.id, code: t.code, name: t.name, description: t.description ?? "", legalBasis: t.legalBasis ?? "", isStatutory: t.isStatutory,
            isPaid: t.isPaid, creditBasis: t.creditBasis, days: Number(t.days), accrual: t.accrual, countCalendarDays: t.countCalendarDays,
            allowHalfDay: t.allowHalfDay, allowNegative: t.allowNegative, minServiceMonths: t.minServiceMonths, eligibility: t.eligibility,
            soloParentOnly: t.soloParentOnly, employmentTypes: t.employmentTypes, maxCarryOver: Number(t.maxCarryOver),
            convertibleToCash: t.convertibleToCash, isActive: t.isActive,
            soloParentExtraDays: Number(t.soloParentExtraDays), maxFilings: t.maxFilings, maxDaysPerYear: t.maxDaysPerYear == null ? null : Number(t.maxDaysPerYear),
          }))}
        />
      </div>
    </main>
  );
}
