import { prisma } from "@/lib/prisma";
import { requirePostingCompany } from "@/lib/currentUser";
import { toPlain } from "@/lib/serialize";
import { suggestNextDocumentNo } from "@/lib/ledgerPosting";
import { PurchasesForm } from "./PurchasesForm";

export default async function PurchasesPage() {
  const company = await requirePostingCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Purchase on Account</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [accounts, payableAccounts, vendors, employees, contacts, customers, atcCodes, locations, suggestedDocumentNo] = await Promise.all([
    prisma.account.findMany({ where: { companyId: company.id, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { companyId: company.id, isActive: true, accountType: "POSTING", classification: "ACCOUNTS_PAYABLE" },
      orderBy: { code: "asc" },
    }),
    prisma.vendor.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
    prisma.employee.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
    prisma.contact.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
    prisma.customer.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
    prisma.atcCode.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.location.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
    suggestNextDocumentNo(company.id, "PURCHASE_ON_ACCOUNT"),
  ]);

  return (
    <PurchasesForm
      companyId={company.id}
      accounts={toPlain(accounts)}
      payableAccounts={toPlain(payableAccounts)}
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
