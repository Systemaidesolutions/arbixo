import { getCurrentCompany } from "@/lib/currentUser";
import { EquityStatementClient } from "./EquityStatementClient";

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

  return <EquityStatementClient companyId={company.id} />;
}
