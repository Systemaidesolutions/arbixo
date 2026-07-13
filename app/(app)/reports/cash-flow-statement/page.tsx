import { getCurrentCompany } from "@/lib/currentUser";
import { TrialBalanceClient } from "../trial-balance/TrialBalanceClient";

export default async function CashFlowStatementPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Cash flow statement</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  return (
    <TrialBalanceClient
      companyId={company.id}
      title="Cash flow statement"
      description="Balances of the company's cash and cash-equivalent accounts for the selected period. Use Current Net Change for the period's cash movement."
      classifications={["CASH_IN_BANK", "CASH_ON_HAND"]}
    />
  );
}
