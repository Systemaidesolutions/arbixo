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

  const [accounts, payableAccounts, vendors, atcCodes, locations, suggestedDocumentNo] = await Promise.all([
    prisma.account.findMany({ where: { companyId: company.id, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { companyId: company.id, isActive: true, accountType: "POSTING", classification: "ACCOUNTS_PAYABLE" },
      orderBy: { code: "asc" },
    }),
    prisma.vendor.findMany({ where: { companyId: company.id, isActive: true }, orderBy: { code: "asc" } }),
    prisma.atcCode.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.location.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
    suggestNextDocumentNo(company.id, "PURCHASE_ON_ACCOUNT"),
  ]);

  const companyPayor = {
    name: company.registeredName || company.tradeName,
    tin: company.tin ?? "",
    address: [company.businessAddress, company.barangay, company.city, company.province].filter(Boolean).join(", "),
    zip: company.zipCode ?? "",
  };

  return (
    <PurchasesForm
      companyId={company.id}
      companyPayor={companyPayor}
      accounts={toPlain(accounts)}
      payableAccounts={toPlain(payableAccounts)}
      vendors={vendors}
      atcCodes={toPlain(atcCodes)}
      locations={locations}
      suggestedDocumentNo={suggestedDocumentNo}
    />
  );
}
