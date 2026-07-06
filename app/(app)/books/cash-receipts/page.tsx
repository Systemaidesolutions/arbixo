import { getCurrentCompany } from "@/lib/currentUser";
import { JournalBookClient } from "../JournalBookClient";

export default async function CashReceiptsBookPage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Cash Receipts Journal</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return (
    <JournalBookClient
      book="cash-receipts"
      title="Cash Receipts Journal"
      registeredName={company.registeredName ?? company.tradeName}
      partyLabel="Received from"
    />
  );
}
