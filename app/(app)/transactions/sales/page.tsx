import { prisma } from "@/lib/prisma";
import { requirePostingCompany } from "@/lib/currentUser";
import { toPlain } from "@/lib/serialize";
import { suggestNextDocumentNo } from "@/lib/ledgerPosting";
import { SalesForm } from "./SalesForm";

export default async function SalesPage() {
  const company = await requirePostingCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Sales on Account</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [accounts, receivableAccounts, customers, atcCodes, locations, suggestedDocumentNo] = await Promise.all([
    prisma.account.findMany({ where: { companyId: company.id, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { companyId: company.id, isActive: true, accountType: "POSTING", classification: "ACCOUNTS_RECEIVABLE" },
      orderBy: { code: "asc" },
    }),
    prisma.customer.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
    prisma.atcCode.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.location.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
    suggestNextDocumentNo(company.id, "SALES_ON_ACCOUNT"),
  ]);

  const companyPayee = {
    name: company.registeredName || company.tradeName,
    tin: company.tin ?? "",
    address: [company.businessAddress, company.barangay, company.city, company.province, company.zipCode].filter(Boolean).join(", "),
  };

  return (
    <SalesForm
      companyId={company.id}
      companyPayee={companyPayee}
      accounts={toPlain(accounts)}
      receivableAccounts={toPlain(receivableAccounts)}
      customers={customers}
      atcCodes={toPlain(atcCodes)}
      locations={locations}
      suggestedDocumentNo={suggestedDocumentNo}
    />
  );
}
