import { requireAdmin } from "@/lib/currentUser";
import { StandardChartSyncClient } from "./StandardChartSyncClient";

export default async function StandardChartSyncPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Standard chart of accounts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Deletes every company&apos;s entire chart of accounts and rebuilds it from only the new standard
        chart (lib/defaultChartOfAccounts.ts) — no old accounts carried over. An account that&apos;s still
        in use (has ledger entries, a child account, or is referenced by a tax-posting setup) can&apos;t be
        deleted and is listed below instead, so it can be reviewed and cleaned up manually in that
        company&apos;s Chart of Accounts screen.
      </p>
      <StandardChartSyncClient />
    </main>
  );
}
