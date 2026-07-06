import { getCurrentCompany } from "@/lib/currentUser";
import { GeneralLedgerBookClient } from "./GeneralLedgerBookClient";

export default async function GeneralLedgerBookPage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">General Ledger</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return <GeneralLedgerBookClient registeredName={company.registeredName ?? company.tradeName} />;
}
