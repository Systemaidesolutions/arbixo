import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { SubsidiaryLedgerClient } from "./SubsidiaryLedgerClient";

export default async function SubsidiaryLedgerPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Debtors' / creditors' ledger</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [customers, vendors] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    prisma.vendor.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
  ]);

  return <SubsidiaryLedgerClient companyId={company.id} customers={customers} vendors={vendors} />;
}
