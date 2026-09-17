import { requireAdmin } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { StandardChartSyncClient } from "./StandardChartSyncClient";

export default async function StandardChartSyncPage() {
  await requireAdmin();

  const companies = await prisma.company.findMany({
    select: { id: true, tradeName: true },
    orderBy: { tradeName: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Standard chart of accounts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Aligns one company&apos;s chart of accounts to the standard chart (lib/defaultChartOfAccounts.ts). Pick the
        company below, then either add any missing standard accounts (safe — never touches or deletes anything
        existing) or delete and rebuild that company&apos;s whole chart from scratch (destructive).
      </p>
      <StandardChartSyncClient companies={companies} />
    </main>
  );
}
