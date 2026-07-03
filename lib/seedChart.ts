import { prisma } from "@/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/defaultChartOfAccounts";

/**
 * Seeds the default nested heading chart into a company. Safe to run on a
 * company that already has accounts: existing codes are skipped, and only the
 * seeded heading rows are (re)parented — a pre-existing account that happens to
 * share a code is never touched. Uses a bulk createMany + raw parent UPDATEs so
 * it doesn't flood the audit trail.
 *
 * Returns how many accounts were newly created.
 */
export async function seedDefaultChart(companyId: string): Promise<number> {
  const result = await prisma.account.createMany({
    skipDuplicates: true,
    data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
      companyId,
      code: a.code,
      title: a.title,
      accountType: a.accountType,
      classification: a.classification,
      normalBalance: a.normalBalance,
      sortOrder: a.sortOrder,
    })),
  });

  const existing = await prisma.account.findMany({
    where: { companyId },
    select: { id: true, code: true, accountType: true },
  });
  const byCode = new Map(existing.map((a) => [a.code, a]));

  for (const a of DEFAULT_CHART_OF_ACCOUNTS) {
    if (!a.parentCode) continue;
    const child = byCode.get(a.code);
    const parent = byCode.get(a.parentCode);
    // Only link the seeded headings — never re-parent a user's own account
    // that happens to share a code with a default heading.
    if (child && parent && child.accountType === "HEADING") {
      await prisma.$executeRaw`UPDATE "Account" SET "parentAccountId" = ${parent.id} WHERE id = ${child.id}`;
    }
  }

  return result.count;
}
