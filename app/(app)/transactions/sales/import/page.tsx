import { requirePostingCompany } from "@/lib/currentUser";
import { TransactionImportClient } from "@/components/TransactionImportClient";

export default async function SalesImportPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Import Sales</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return (
    <TransactionImportClient
      endpoint="/api/ledger-entries/sales/import"
      templateUrl="/api/ledger-entries/sales/import/template"
      title="Import Sales"
      subtitle="Upload a .csv or .xlsx to post many invoices at once. One row per income line; rows sharing an invoice no. combine into one invoice. Set Is Return = Yes for a credit memo."
      refLabel="Invoice no."
    />
  );
}
