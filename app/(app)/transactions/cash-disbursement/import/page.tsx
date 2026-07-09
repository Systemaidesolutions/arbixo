import { requirePostingCompany } from "@/lib/currentUser";
import { TransactionImportClient } from "@/components/TransactionImportClient";

export default async function CashDisbursementImportPage() {
  const company = await requirePostingCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Import Cash Disbursement</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return (
    <TransactionImportClient
      endpoint="/api/ledger-entries/cash-disbursement/import"
      templateUrl="/api/ledger-entries/cash-disbursement/import/template"
      title="Import Cash Disbursement"
      subtitle="Upload a .csv or .xlsx to post many vouchers at once. One row per expense line; rows sharing a CV no. combine into one voucher."
      refLabel="CV no."
    />
  );
}
