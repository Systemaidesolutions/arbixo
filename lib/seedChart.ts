import { prisma } from "@/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/defaultChartOfAccounts";

/**
 * Seeds the default nested chart of accounts into a company.
 *
 * Uses a bulk createMany (a single audit-trail entry, not one per account)
 * for the rows, then links each child to its parent with raw UPDATEs — which
 * the audit extension doesn't record — so a brand-new company doesn't open
 * with dozens of "account created" trail rows.
 */
export async function seedDefaultChart(companyId: string): Promise<number> {
  await prisma.account.createMany({
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

  const created = await prisma.account.findMany({
    where: { companyId },
    select: { id: true, code: true },
  });
  const idByCode = new Map(created.map((a) => [a.code, a.id]));

  for (const a of DEFAULT_CHART_OF_ACCOUNTS) {
    if (!a.parentCode) continue;
    const childId = idByCode.get(a.code);
    const parentId = idByCode.get(a.parentCode);
    if (childId && parentId) {
      await prisma.$executeRaw`UPDATE "Account" SET "parentAccountId" = ${parentId} WHERE id = ${childId}`;
    }
  }

  return DEFAULT_CHART_OF_ACCOUNTS.length;
}
