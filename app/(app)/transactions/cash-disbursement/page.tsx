import { prisma } from "@/lib/prisma";
import { requirePostingCompany } from "@/lib/currentUser";
import { toPlain } from "@/lib/serialize";
import { suggestNextDocumentNo } from "@/lib/ledgerPosting";
import { CashDisbursementForm } from "./CashDisbursementForm";

export default async function CashDisbursementPage() {
  const company = await requirePostingCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Cash Disbursement</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [accounts, cashAccounts, vendors, employees, contacts, customers, atcCodes, locations, suggestedDocumentNo] =
    await Promise.all([
      prisma.account.findMany({ where: { companyId: company.id, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" } }),
      prisma.account.findMany({
        where: { companyId: company.id, isActive: true, accountType: "POSTING", classification: { in: ["CASH_IN_BANK", "CASH_ON_HAND"] } },
        orderBy: { code: "asc" },
      }),
      prisma.vendor.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
      prisma.employee.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
      prisma.contact.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
      prisma.customer.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
      prisma.atcCode.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.location.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
      suggestNextDocumentNo(company.id, "CASH_DISBURSEMENT"),
    ]);

  return (
    <CashDisbursementForm
      companyId={company.id}
      accounts={toPlain(accounts)}
      cashAccounts={toPlain(cashAccounts)}
      vendors={vendors}
      employees={employees}
      contacts={contacts}
      customers={customers}
      atcCodes={toPlain(atcCodes)}
      locations={locations}
      suggestedDocumentNo={suggestedDocumentNo}
    />
  );
}
