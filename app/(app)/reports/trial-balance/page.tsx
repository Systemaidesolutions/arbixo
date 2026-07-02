import { getCurrentCompany } from "@/lib/currentUser";
import { TrialBalanceClient } from "./TrialBalanceClient";

export default async function TrialBalancePage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Trial balance</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  return <TrialBalanceClient companyId={company.id} />;
}
