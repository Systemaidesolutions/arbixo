import { requirePostingCompany } from "@/lib/currentUser";
import { TransactionImportClient } from "@/components/TransactionImportClient";

export default async function PurchasesImportPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Import Purchases</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return (
    <TransactionImportClient
      endpoint="/api/ledger-entries/purchases/import"
      templateUrl="/api/ledger-entries/purchases/import/template"
      title="Import Purchases"
      subtitle="Upload a .csv or .xlsx to post many bills at once. One row per expense line; rows sharing a PV no. combine into one bill. Set Is Return = Yes for a debit/credit memo."
      refLabel="PV no."
    />
  );
}
