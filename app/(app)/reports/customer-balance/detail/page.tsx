import { getCurrentCompany } from "@/lib/currentUser";
import { CustomerBalanceDetailAllClient } from "./CustomerBalanceDetailAllClient";

export default async function CustomerBalanceDetailAllPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">Customer Balance Detail Report</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  return (
    <CustomerBalanceDetailAllClient
      registeredName={company.registeredName || company.tradeName}
      initialDateFrom={searchParams.dateFrom ?? ""}
      initialDateTo={searchParams.dateTo ?? ""}
    />
  );
}
