import { prisma } from "@/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/defaultChartOfAccounts";

const norm = (s: string) => s.trim().toLowerCase();

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

export type ChartSyncConflict = {
  code: string;
  standardTitle: string;
  existingAccountId: string;
  existingTitle: string;
  hasActivity: boolean;
};

export type ChartSyncResult = {
  companyId: string;
  companyName: string;
  created: number;
  conflicts: ChartSyncConflict[];
};

/**
 * Aligns one company's chart to the standard chart WITHOUT ever deleting or
 * overwriting an existing account — codes already used by that company for
 * something else (e.g. an older numbering scheme) are left untouched and
 * reported back as a conflict for manual review in the Chart of Accounts
 * screen, since blindly repurposing a code that may already have ledger
 * entries posted against it would corrupt those entries' meaning.
 */
export async function syncStandardChartForCompany(companyId: string, companyName: string): Promise<ChartSyncResult> {
  const existing = await prisma.account.findMany({
    where: { companyId },
    select: { id: true, code: true, title: true, accountType: true },
  });
  const byCode = new Map(existing.map((a) => [a.code, a]));

  const toCreate = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => !byCode.has(a.code));
  const created = toCreate.length
    ? (
        await prisma.account.createMany({
          skipDuplicates: true,
          data: toCreate.map((a) => ({
            companyId,
            code: a.code,
            title: a.title,
            accountType: a.accountType,
            classification: a.classification,
            normalBalance: a.normalBalance,
            sortOrder: a.sortOrder,
          })),
        })
      ).count
    : 0;

  if (toCreate.length > 0) {
    const refreshed = await prisma.account.findMany({
      where: { companyId },
      select: { id: true, code: true, accountType: true },
    });
    const refreshedByCode = new Map(refreshed.map((a) => [a.code, a]));
    const createdCodes = new Set(toCreate.map((a) => a.code));
    for (const a of DEFAULT_CHART_OF_ACCOUNTS) {
      if (!a.parentCode || !createdCodes.has(a.code)) continue;
      const child = refreshedByCode.get(a.code);
      const parent = refreshedByCode.get(a.parentCode);
      if (child && parent && parent.accountType === "HEADING") {
        await prisma.$executeRaw`UPDATE "Account" SET "parentAccountId" = ${parent.id} WHERE id = ${child.id}`;
      }
    }
  }

  const conflictDefs = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => {
    const ex = byCode.get(a.code);
    return ex && norm(ex.title) !== norm(a.title);
  });
  const conflicts: ChartSyncConflict[] = [];
  for (const a of conflictDefs) {
    const ex = byCode.get(a.code)!;
    const activityCount = await prisma.ledgerEntry.count({ where: { accountId: ex.id } });
    conflicts.push({
      code: a.code,
      standardTitle: a.title,
      existingAccountId: ex.id,
      existingTitle: ex.title,
      hasActivity: activityCount > 0,
    });
  }

  return { companyId, companyName, created, conflicts };
}

/** Runs syncStandardChartForCompany across every company. Non-destructive — see that function's notes. */
export async function syncStandardChartForAllCompanies(): Promise<ChartSyncResult[]> {
  const companies = await prisma.company.findMany({ select: { id: true, tradeName: true } });
  const results: ChartSyncResult[] = [];
  for (const c of companies) {
    results.push(await syncStandardChartForCompany(c.id, c.tradeName));
  }
  return results;
}

export type ChartResetResult = ChartSyncResult & {
  deletedCount: number;
  keptAccounts: { code: string; title: string }[];
};

/**
 * Wipes a company's entire chart of accounts and rebuilds it from scratch
 * using only the standard chart — no old codes carried over. Every existing
 * account is deleted, EXCEPT one that a Postgres FK constraint refuses to
 * let go (it still has ledger entries posted to it, a child account, or a
 * tax-posting-setup reference) — that's the safety net that keeps this from
 * destroying real transaction history, and any such account is left in
 * place and reported back so it can be reviewed manually. Runs several
 * passes so a heading only becomes deletable once its own children are gone.
 */
export async function resetCompanyToStandardChart(companyId: string, companyName: string): Promise<ChartResetResult> {
  let candidates = await prisma.account.findMany({ where: { companyId } });

  let deletedCount = 0;
  for (let pass = 0; pass < 8 && candidates.length > 0; pass++) {
    const stillThere: typeof candidates = [];
    for (const a of candidates) {
      try {
        await prisma.account.delete({ where: { id: a.id } });
        deletedCount++;
      } catch {
        stillThere.push(a);
      }
    }
    candidates = stillThere;
  }
  const keptAccounts = candidates.map((a) => ({ code: a.code, title: a.title }));

  const syncResult = await syncStandardChartForCompany(companyId, companyName);
  return { ...syncResult, deletedCount, keptAccounts };
}

/** Runs resetCompanyToStandardChart across every company. */
export async function resetAllCompaniesToStandardChart(): Promise<ChartResetResult[]> {
  const companies = await prisma.company.findMany({ select: { id: true, tradeName: true } });
  const results: ChartResetResult[] = [];
  for (const c of companies) {
    results.push(await resetCompanyToStandardChart(c.id, c.tradeName));
  }
  return results;
}
