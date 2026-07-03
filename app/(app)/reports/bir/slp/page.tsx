import { getCurrentCompany } from "@/lib/currentUser";
import { SlspClient } from "../slsp/SlspClient";

export default async function SlpPage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Summary List of Purchases</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  return <SlspClient kind="slp" tin={company.tin} registeredName={company.registeredName ?? company.tradeName} />;
}
