import { requirePostingCompany } from "@/lib/currentUser";
import { TransactionImportClient } from "@/components/TransactionImportClient";

export default async function GeneralJournalImportPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Import General Journal</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return (
    <TransactionImportClient
      endpoint="/api/ledger-entries/general-journal/import"
      templateUrl="/api/ledger-entries/general-journal/import/template"
      title="Import General Journal"
      subtitle="Upload a .csv or .xlsx to post many journal entries at once. One row per line (Account + Debit or Credit); rows sharing a JV no. combine into one entry that must balance."
      refLabel="JV no."
    />
  );
}
