import { requireAdmin } from "@/lib/currentUser";
import { StandardChartSyncClient } from "./StandardChartSyncClient";

export default async function StandardChartSyncPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Standard chart of accounts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Adds any account from the standard chart (lib/defaultChartOfAccounts.ts) that a company doesn&apos;t
        already have. Existing accounts are never renamed or deleted — if a company already has a code
        under a different name (from an older chart), it&apos;s listed below as a conflict for you to review
        and clean up manually in that company&apos;s Chart of Accounts screen.
      </p>
      <StandardChartSyncClient />
    </main>
  );
}
