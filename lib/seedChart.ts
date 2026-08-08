import { prisma } from "@/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS, type DefaultAccount } from "@/lib/defaultChartOfAccounts";

const norm = (s: string) => s.trim().toLowerCase();

// The chart previously seeded into every company, before it was replaced by
// the client-approved standard chart in defaultChartOfAccounts.ts. Kept only
// so migrateCompanyToStandardChart() can recognize an untouched old-seed
// heading (safe to drop and replace with the new code) vs. an account the
// company actually renamed, restructured, or posted to (never touched).
const LEGACY_DEFAULT_CHART: DefaultAccount[] = [
  { code: "10000", title: "ASSETS", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: null, sortOrder: 0 },
  { code: "11000", title: "CURRENT ASSETS", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "10000", sortOrder: 1 },
  { code: "11100", title: "Cash and Cash Equivalents", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "11000", sortOrder: 2 },
  { code: "11200", title: "Accounts Receivable", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "11000", sortOrder: 3 },
  { code: "11300", title: "Merchandise Inventory", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "11000", sortOrder: 4 },
  { code: "11400", title: "Prepayments", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "11000", sortOrder: 5 },
  { code: "11500", title: "Input VAT", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "11000", sortOrder: 6 },
  { code: "11600", title: "Other Current Assets", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "11000", sortOrder: 7 },
  { code: "12200", title: "NON-CURRENT ASSETS", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "10000", sortOrder: 8 },
  { code: "12010", title: "Land", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "12200", sortOrder: 9 },
  { code: "12020", title: "Fixed Asset", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "12200", sortOrder: 10 },
  { code: "12030", title: "Goodwill", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "12200", sortOrder: 11 },
  { code: "12040", title: "Accumulated Depreciation", accountType: "HEADING", classification: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", parentCode: "12200", sortOrder: 12 },
  { code: "20000", title: "LIABILITIES", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: null, sortOrder: 13 },
  { code: "21000", title: "CURRENT LIABILITIES", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "20000", sortOrder: 14 },
  { code: "21100", title: "Accounts Payable", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "21000", sortOrder: 15 },
  { code: "21200", title: "Notes Payable", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "21000", sortOrder: 16 },
  { code: "21300", title: "Accrued Expenses", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "21000", sortOrder: 17 },
  { code: "21400", title: "Government Payable", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "21000", sortOrder: 18 },
  { code: "21500", title: "Other Current Liabilities", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "21000", sortOrder: 19 },
  { code: "22000", title: "NONCURRENT LIABILITY", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "20000", sortOrder: 20 },
  { code: "22010", title: "Long-term Notes Payable", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "22000", sortOrder: 21 },
  { code: "22020", title: "Other Non-Current Payable", accountType: "HEADING", classification: "OTHER_CURRENT_LIABILITY", normalBalance: "CREDIT", parentCode: "22000", sortOrder: 22 },
  { code: "30000", title: "EQUITY", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: null, sortOrder: 23 },
  { code: "31000", title: "Capital Stock", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: "30000", sortOrder: 24 },
  { code: "31100", title: "Additional Paid-in Capital", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: "30000", sortOrder: 25 },
  { code: "31200", title: "Owner's Capital", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: "30000", sortOrder: 26 },
  { code: "31300", title: "Owner's Drawings", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: "30000", sortOrder: 27 },
  { code: "31400", title: "Retained Earnings", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: "30000", sortOrder: 28 },
  { code: "31500", title: "Current Year Earnings", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: "30000", sortOrder: 29 },
  { code: "31600", title: "Prior Year Adjustments", accountType: "HEADING", classification: "EQUITY_DOES_NOT_CLOSE", normalBalance: "CREDIT", parentCode: "30000", sortOrder: 30 },
  { code: "40000", title: "REVENUE", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: null, sortOrder: 31 },
  { code: "41000", title: "Sales", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "40000", sortOrder: 32 },
  { code: "41110", title: "VATable Sales", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "41000", sortOrder: 33 },
  { code: "41200", title: "Zero Rated Sales", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "41000", sortOrder: 34 },
  { code: "41300", title: "Exempt Sales", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "41000", sortOrder: 35 },
  { code: "41400", title: "Non-VAT Sales", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "41000", sortOrder: 36 },
  { code: "41040", title: "Sales Returns and Allowances (-)", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "41000", sortOrder: 37 },
  { code: "41050", title: "Sales Discount (-)", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "41000", sortOrder: 38 },
  { code: "42000", title: "Other Income", accountType: "HEADING", classification: "REVENUE", normalBalance: "CREDIT", parentCode: "40000", sortOrder: 39 },
  { code: "50000", title: "COST OF SALES / SERVICES", accountType: "HEADING", classification: "EXPENSE", normalBalance: "DEBIT", parentCode: null, sortOrder: 40 },
  { code: "51000", title: "Cost of Goods Sold", accountType: "HEADING", classification: "EXPENSE", normalBalance: "DEBIT", parentCode: "50000", sortOrder: 41 },
  { code: "52000", title: "Cost of Services", accountType: "HEADING", classification: "EXPENSE", normalBalance: "DEBIT", parentCode: "50000", sortOrder: 42 },
  { code: "6000", title: "OPERATING EXPENSES", accountType: "HEADING", classification: "EXPENSE", normalBalance: "DEBIT", parentCode: null, sortOrder: 43 },
  { code: "80000", title: "OTHER EXPENSES", accountType: "HEADING", classification: "EXPENSE", normalBalance: "DEBIT", parentCode: null, sortOrder: 44 },
];

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

export type ChartMigrationResult = ChartSyncResult & {
  droppedOldCodes: string[];
  keptOldCodes: string[];
};

/**
 * Renumbers a company's chart onto the new standard codes: any account that
 * still exactly matches the OLD default seed (title/classification/
 * normalBalance/type all untouched) is dropped so the new code can take its
 * place — the database itself is the safety check here, since a Postgres FK
 * constraint blocks the delete (and this catches it and leaves the row
 * alone) if the account still has children or ledger entries, i.e. if the
 * company actually used or customized it. Runs several passes so a heading
 * only becomes deletable once its own (also-untouched) children are gone.
 * Finishes by laying down the standard chart via syncStandardChartForCompany.
 */
export async function migrateCompanyToStandardChart(companyId: string, companyName: string): Promise<ChartMigrationResult> {
  const accounts = await prisma.account.findMany({ where: { companyId } });
  const legacyByCode = new Map(LEGACY_DEFAULT_CHART.map((a) => [a.code, a]));

  let candidates = accounts.filter((a) => {
    const legacy = legacyByCode.get(a.code);
    return (
      legacy &&
      norm(a.title) === norm(legacy.title) &&
      a.classification === legacy.classification &&
      a.normalBalance === legacy.normalBalance &&
      a.accountType === legacy.accountType
    );
  });

  const droppedOldCodes: string[] = [];
  for (let pass = 0; pass < 6 && candidates.length > 0; pass++) {
    const stillThere: typeof candidates = [];
    for (const a of candidates) {
      try {
        await prisma.account.delete({ where: { id: a.id } });
        droppedOldCodes.push(a.code);
      } catch {
        stillThere.push(a);
      }
    }
    candidates = stillThere;
  }
  const keptOldCodes = candidates.map((a) => a.code);

  const syncResult = await syncStandardChartForCompany(companyId, companyName);
  return { ...syncResult, droppedOldCodes, keptOldCodes };
}

/** Runs migrateCompanyToStandardChart across every company. */
export async function migrateAllCompaniesToStandardChart(): Promise<ChartMigrationResult[]> {
  const companies = await prisma.company.findMany({ select: { id: true, tradeName: true } });
  const results: ChartMigrationResult[] = [];
  for (const c of companies) {
    results.push(await migrateCompanyToStandardChart(c.id, c.tradeName));
  }
  return results;
}
