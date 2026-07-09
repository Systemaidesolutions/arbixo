import { requirePostingCompany } from "@/lib/currentUser";
import { TransactionImportClient } from "@/components/TransactionImportClient";

export default async function ImportationsImportPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Import Importations</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return (
    <TransactionImportClient
      endpoint="/api/importations/import"
      templateUrl="/api/importations/import/template"
      title="Import Importations"
      subtitle="Upload a .csv or .xlsx to record many importations at once. One row per importation. VAT is computed automatically (12% of dutiable value + charges, unless VAT-exempt)."
      refLabel="OR no."
    />
  );
}
