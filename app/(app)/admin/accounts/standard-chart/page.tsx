import { requireAdmin } from "@/lib/currentUser";
import { StandardChartSyncClient } from "./StandardChartSyncClient";

export default async function StandardChartSyncPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Standard chart of accounts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Renumbers every company onto the new standard chart. Old default headings that were never
        renamed or posted to are dropped so the new code can take their place; anything a company
        actually customized or used (has sub-accounts or ledger entries) is left exactly as-is and
        listed below as a conflict for you to review and clean up manually in that company&apos;s
        Chart of Accounts screen.
      </p>
      <StandardChartSyncClient />
    </main>
  );
}
