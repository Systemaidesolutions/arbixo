import { getCurrentCompany } from "@/lib/currentUser";
import { BalanceSheetClient } from "./BalanceSheetClient";

export default async function BalanceSheetPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-medium text-neutral-900">Balance sheet</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  return (
    <BalanceSheetClient companyId={company.id} fiscalMonthEnd={company.fiscalMonthEnd ?? 12} />
  );
}
