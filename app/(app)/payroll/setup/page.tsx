import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup } from "@/lib/payroll/server";
import { SetupClient } from "./SetupClient";

export default async function PayrollSetupPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  const canEdit = Boolean(capability?.canPost);

  if (!company) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Payroll setup</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const setup = await getOrCreateSetup(company.id);
  const [groups, items, accounts] = await Promise.all([
    prisma.payGroup.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    prisma.payItem.findMany({ where: { companyId: company.id }, orderBy: [{ kind: "asc" }, { code: "asc" }] }),
    prisma.account.findMany({ where: { companyId: company.id, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
  ]);

  const n = (v: unknown) => Number(v);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Payroll setup</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pay rules, posting accounts, pay groups and earning/deduction items for this company. Each company sets these to match its own policy.
      </p>
      <div className="mt-6">
        <SetupClient
          canEdit={canEdit}
          accounts={accounts}
          setup={{
            workDaysPerYear: setup.workDaysPerYear, hoursPerDay: n(setup.hoursPerDay), otMultiplier: n(setup.otMultiplier),
            restDayMultiplier: n(setup.restDayMultiplier), specialHolidayMultiplier: n(setup.specialHolidayMultiplier),
            regularHolidayMultiplier: n(setup.regularHolidayMultiplier), nightDiffRate: n(setup.nightDiffRate),
            payUnworkedRegularHoliday: setup.payUnworkedRegularHoliday,
            salariesExpenseAccountId: setup.salariesExpenseAccountId, contributionsExpenseAccountId: setup.contributionsExpenseAccountId,
            sssPayableAccountId: setup.sssPayableAccountId, philhealthPayableAccountId: setup.philhealthPayableAccountId,
            hdmfPayableAccountId: setup.hdmfPayableAccountId, withholdingTaxPayableAccountId: setup.withholdingTaxPayableAccountId,
            otherDeductionsAccountId: setup.otherDeductionsAccountId, netPayAccountId: setup.netPayAccountId,
          }}
          groups={groups.map((g) => ({ id: g.id, code: g.code, name: g.name, frequency: g.frequency, deductSss: g.deductSss, deductPhilhealth: g.deductPhilhealth, deductHdmf: g.deductHdmf, withholdTax: g.withholdTax, isActive: g.isActive }))}
          items={items.map((i) => ({ id: i.id, code: i.code, name: i.name, kind: i.kind, taxable: i.taxable, accountId: i.accountId, isActive: i.isActive }))}
        />
      </div>
    </main>
  );
}
