import { getCurrentCompany } from "@/lib/currentUser";
import { TrialBalanceClient } from "../trial-balance/TrialBalanceClient";

export default async function EquityStatementPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Equity statement</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  return (
    <TrialBalanceClient
      companyId={company.id}
      title="Equity statement"
      description="Balances of the company's equity accounts for the selected period. Year-to-Date carries the opening balance; Current Net Change shows only the movement within the period."
      classifications={["EQUITY_DOES_NOT_CLOSE", "EQUITY_GETS_CLOSED"]}
    />
  );
}
