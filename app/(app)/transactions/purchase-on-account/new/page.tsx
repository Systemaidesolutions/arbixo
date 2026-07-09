import { requirePostingCompany } from "@/lib/currentUser";
import { loadPurchaseFormData } from "@/lib/purchaseDocFormData";
import { suggestTransactionNo } from "@/lib/purchaseDocs";
import { PurchaseDocForm } from "../PurchaseDocForm";

export default async function NewPurchaseDocPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Purchase on Account</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const [data, suggestedNo] = await Promise.all([loadPurchaseFormData(company.id), suggestTransactionNo(company.id)]);
  return (
    <PurchaseDocForm
      vendors={data.vendors}
      items={data.items}
      accounts={data.accounts}
      branches={data.branches}
      inputVatAccountId={data.inputVatAccountId}
      suggestedNo={suggestedNo}
    />
  );
}
