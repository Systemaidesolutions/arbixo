import { prisma } from "@/lib/prisma";
import type { Account } from "@prisma/client";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(d: unknown): number {
  return Number(d ?? 0);
}

// Every calculation here works in "debit-positive" terms internally —
// a positive number always means a debit balance, negative means
// credit — regardless of the account's own normalBalance. Display code
// converts to a Debit/Credit column split at the end. This is
// deliberate: a trial balance should show an account's ACTUAL sign
// (e.g. a bank overdraft on a normally-debit Cash account shows as a
// credit), not force it into its "designed" column.
function openingBalanceSigned(account: Pick<Account, "openingBalance" | "normalBalance">): number {
  const opening = num(account.openingBalance);
  return account.normalBalance === "DEBIT" ? opening : -opening;
}

// Shared by Trial Balance, Income Statement, and Balance Sheet — computes
// each account's net debit-credit movement within a date filter, with no
// opening balance folded in (callers decide whether that applies).
async function getAccountNetMovements(
  companyId: string,
  dateFilter: { lte: Date } | { gte: Date; lte: Date }
): Promise<Map<string, number>> {
  const grouped = await prisma.ledgerEntry.groupBy({
    by: ["accountId"],
    where: { companyId, isCancelled: false, postingDate: dateFilter },
    _sum: { debitAmount: true, creditAmount: true },
  });
  return new Map(grouped.map((g) => [g.accountId, num(g._sum.debitAmount) - num(g._sum.creditAmount)]));
}

async function getEarliestPostingDate(companyId: string): Promise<Date> {
  const first = await prisma.ledgerEntry.findFirst({
    where: { companyId },
    orderBy: { postingDate: "asc" },
    select: { postingDate: true },
  });
  return first?.postingDate ?? new Date(2000, 0, 1);
}

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  title: string;
  classification: string;
  debit: number;
  credit: number;
};

export type TrialBalanceMode = "YEAR_TO_DATE" | "NET_CHANGE";

/**
 * YEAR_TO_DATE: cumulative balance as of asOfDate — every entry ever
 * posted up to that date, plus the account's opening balance. This is
 * what should tie out to the Balance Sheet.
 *
 * NET_CHANGE: only the movement within [dateFrom, dateTo] — no opening
 * balance included. Doesn't need to balance to zero per account, but
 * total debit MUST equal total credit across all accounts either way,
 * since every document ever posted through postDocument() was already
 * balanced when it went in.
 */
export async function getTrialBalance(
  companyId: string,
  opts: { mode: TrialBalanceMode; asOfDate?: Date; dateFrom?: Date; dateTo?: Date }
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> {
  const accounts = await prisma.account.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const dateFilter =
    opts.mode === "YEAR_TO_DATE" ? { lte: opts.asOfDate! } : { gte: opts.dateFrom!, lte: opts.dateTo! };
  const movements = await getAccountNetMovements(companyId, dateFilter);

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of accounts) {
    const netMovement = movements.get(account.id) ?? 0;
    const raw = opts.mode === "YEAR_TO_DATE" ? netMovement + openingBalanceSigned(account) : netMovement;

    // Skip accounts with nothing to show — no movement in the period and
    // no (YTD) balance — to keep the report from listing every unused
    // account in the chart.
    if (Math.abs(raw) < 0.005) continue;

    const debit = raw > 0 ? raw : 0;
    const credit = raw < 0 ? -raw : 0;
    rows.push({
      accountId: account.id,
      code: account.code,
      title: account.title,
      classification: account.classification,
      debit: round2(debit),
      credit: round2(credit),
    });
    totalDebit += debit;
    totalCredit += credit;
  }

  return { rows, totalDebit: round2(totalDebit), totalCredit: round2(totalCredit) };
}

export type IncomeStatementLine = { accountId: string; code: string; title: string; amount: number };

export type IncomeStatement = {
  revenue: IncomeStatementLine[];
  expense: IncomeStatementLine[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
};

/** Revenue and Expense are temporary accounts — always period-based, never
 * cumulative-since-inception, so this only ever uses NET_CHANGE-style
 * movement (no opening balance). */
export async function getIncomeStatement(
  companyId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<IncomeStatement> {
  const accounts = await prisma.account.findMany({
    where: { companyId, classification: { in: ["REVENUE", "EXPENSE"] } },
    orderBy: { code: "asc" },
  });
  const movements = await getAccountNetMovements(companyId, { gte: dateFrom, lte: dateTo });

  const revenue: IncomeStatementLine[] = [];
  const expense: IncomeStatementLine[] = [];

  for (const account of accounts) {
    const raw = movements.get(account.id) ?? 0;
    if (Math.abs(raw) < 0.005) continue;

    // Revenue is credit-normal (raw is debit-positive), so revenue
    // earned is -raw. Expense is debit-normal, so expense incurred is
    // +raw directly.
    if (account.classification === "REVENUE") {
      revenue.push({ accountId: account.id, code: account.code, title: account.title, amount: round2(-raw) });
    } else {
      expense.push({ accountId: account.id, code: account.code, title: account.title, amount: round2(raw) });
    }
  }

  const totalRevenue = round2(revenue.reduce((s, l) => s + l.amount, 0));
  const totalExpense = round2(expense.reduce((s, l) => s + l.amount, 0));
  return { revenue, expense, totalRevenue, totalExpense, netIncome: round2(totalRevenue - totalExpense) };
}

const ASSET_CLASSIFICATIONS = [
  "CASH_IN_BANK", "CASH_ON_HAND", "ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET",
  "INVENTORY", "FIXED_ASSET", "ACCUMULATED_DEPRECIATION", "OTHER_ASSET",
];
const LIABILITY_CLASSIFICATIONS = ["ACCOUNTS_PAYABLE", "OTHER_CURRENT_LIABILITY", "LONG_TERM_PAYABLE"];
const EQUITY_CLASSIFICATIONS = ["EQUITY_DOES_NOT_CLOSE", "EQUITY_GETS_CLOSED"];

export type BalanceSheetLine = { accountId: string; code: string; title: string; amount: number };

export type BalanceSheet = {
  asOfDate: Date;
  assets: BalanceSheetLine[];
  totalAssets: number;
  liabilities: BalanceSheetLine[];
  totalLiabilities: number;
  equity: BalanceSheetLine[];
  totalEquityRecorded: number;
  currentPeriodEarnings: number;
  priorUnclosedEarnings: number;
  totalEquityAndEarnings: number;
  totalLiabilitiesAndEquity: number;
};

/**
 * The subtlety here: Revenue/Expense are temporary accounts that
 * real-world bookkeeping "closes" to Equity (EQUITY_GETS_CLOSED) at each
 * fiscal year end via a General Journal entry — this system doesn't
 * automate that close. If it hasn't happened, a naive Balance Sheet that
 * only folds in the *current* fiscal year's net income won't balance
 * against Assets, because prior years' un-closed revenue/expense still
 * exists in the ledger contributing to Assets/Liabilities but with
 * nowhere to land on the Equity side.
 *
 * Fix: split all-time net income (since the earliest posted entry) into
 * "current period" and "prior periods, not yet closed" and show both.
 * This makes the Balance Sheet balance unconditionally — provided
 * opening balances were themselves entered in a balanced way — while
 * being transparent about what's actually driving the numbers. A
 * nonzero "prior unclosed earnings" line is a signal to close the books
 * for that year, not a bug in this calculation.
 */
export async function getBalanceSheet(
  companyId: string,
  asOfDate: Date,
  fiscalYearStart: Date
): Promise<BalanceSheet> {
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      classification: { in: [...ASSET_CLASSIFICATIONS, ...LIABILITY_CLASSIFICATIONS, ...EQUITY_CLASSIFICATIONS] },
    },
    orderBy: { code: "asc" },
  });
  const movements = await getAccountNetMovements(companyId, { lte: asOfDate });

  const assets: BalanceSheetLine[] = [];
  const liabilities: BalanceSheetLine[] = [];
  const equity: BalanceSheetLine[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquityRecorded = 0;

  for (const account of accounts) {
    const netMovement = movements.get(account.id) ?? 0;
    const raw = netMovement + openingBalanceSigned(account);
    if (Math.abs(raw) < 0.005) continue;

    const line = { accountId: account.id, code: account.code, title: account.title };
    if (ASSET_CLASSIFICATIONS.includes(account.classification)) {
      assets.push({ ...line, amount: round2(raw) });
      totalAssets += raw;
    } else if (LIABILITY_CLASSIFICATIONS.includes(account.classification)) {
      liabilities.push({ ...line, amount: round2(-raw) }); // credit-normal, display positive
      totalLiabilities += -raw;
    } else {
      equity.push({ ...line, amount: round2(-raw) }); // credit-normal, display positive
      totalEquityRecorded += -raw;
    }
  }

  const earliestDate = await getEarliestPostingDate(companyId);
  const [allTime, currentPeriod] = await Promise.all([
    getIncomeStatement(companyId, earliestDate, asOfDate),
    getIncomeStatement(companyId, fiscalYearStart, asOfDate),
  ]);
  const currentPeriodEarnings = currentPeriod.netIncome;
  const priorUnclosedEarnings = round2(allTime.netIncome - currentPeriod.netIncome);

  return {
    asOfDate,
    assets,
    totalAssets: round2(totalAssets),
    liabilities,
    totalLiabilities: round2(totalLiabilities),
    equity,
    totalEquityRecorded: round2(totalEquityRecorded),
    currentPeriodEarnings,
    priorUnclosedEarnings,
    totalEquityAndEarnings: round2(totalEquityRecorded + currentPeriodEarnings + priorUnclosedEarnings),
    totalLiabilitiesAndEquity: round2(
      totalLiabilities + totalEquityRecorded + currentPeriodEarnings + priorUnclosedEarnings
    ),
  };
}

export type SubsidiaryLedgerRow = {
  id: string;
  entryNo: number;
  postingDate: Date;
  journalType: string;
  documentNo: string;
  accountCode: string;
  accountTitle: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
};

/**
 * A customer's/vendor's subsidiary ledger tracks their Accounts
 * Receivable/Payable balance specifically — NOT every ledger line
 * tagged with that party. A Sales entry tags the customer on both the
 * AR line and the Income line; summing both would double-count. Filter
 * by party AND by account classification (ACCOUNTS_RECEIVABLE for
 * customers, ACCOUNTS_PAYABLE for vendors) to get only the movements
 * that actually affect what they owe/are owed.
 */
export async function getSubsidiaryLedger(
  companyId: string,
  partyType: "CUSTOMER" | "VENDOR",
  partyId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{ beginningBalance: number; rows: SubsidiaryLedgerRow[]; endingBalance: number }> {
  const classification = partyType === "CUSTOMER" ? "ACCOUNTS_RECEIVABLE" : "ACCOUNTS_PAYABLE";
  const partyFilter = partyType === "CUSTOMER" ? { customerId: partyId } : { vendorId: partyId };

  const [priorAgg, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        companyId,
        isCancelled: false,
        ...partyFilter,
        account: { classification },
        postingDate: { lt: dateFrom },
      },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        isCancelled: false,
        ...partyFilter,
        account: { classification },
        postingDate: { gte: dateFrom, lte: dateTo },
      },
      include: { account: true },
      orderBy: [{ postingDate: "asc" }, { entryNo: "asc" }],
    }),
  ]);

  let runningBalance = num(priorAgg._sum.debitAmount) - num(priorAgg._sum.creditAmount);
  const beginningBalance = round2(runningBalance);

  const rows: SubsidiaryLedgerRow[] = entries.map((e) => {
    const debit = num(e.debitAmount);
    const credit = num(e.creditAmount);
    runningBalance += debit - credit;
    return {
      id: e.id,
      entryNo: e.entryNo,
      postingDate: e.postingDate,
      journalType: e.journalType,
      documentNo: e.documentNo,
      accountCode: e.account.code,
      accountTitle: e.account.title,
      description: e.description,
      debit: round2(debit),
      credit: round2(credit),
      runningBalance: round2(runningBalance),
    };
  });

  return { beginningBalance, rows, endingBalance: round2(runningBalance) };
}

export type GeneralLedgerRow = {
  id: string;
  entryNo: number;
  postingDate: Date;
  journalType: string;
  documentNo: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
};

export async function getGeneralLedger(
  companyId: string,
  accountId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{ account: Account; beginningBalance: number; rows: GeneralLedgerRow[]; endingBalance: number }> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.companyId !== companyId) {
    throw new Error("Account not found");
  }

  const [priorAgg, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { companyId, accountId, isCancelled: false, postingDate: { lt: dateFrom } },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { companyId, accountId, isCancelled: false, postingDate: { gte: dateFrom, lte: dateTo } },
      orderBy: [{ postingDate: "asc" }, { entryNo: "asc" }],
    }),
  ]);

  let runningBalance =
    openingBalanceSigned(account) + num(priorAgg._sum.debitAmount) - num(priorAgg._sum.creditAmount);
  const beginningBalance = round2(runningBalance);

  const rows: GeneralLedgerRow[] = entries.map((e) => {
    const debit = num(e.debitAmount);
    const credit = num(e.creditAmount);
    runningBalance += debit - credit;
    return {
      id: e.id,
      entryNo: e.entryNo,
      postingDate: e.postingDate,
      journalType: e.journalType,
      documentNo: e.documentNo,
      description: e.description,
      debit: round2(debit),
      credit: round2(credit),
      runningBalance: round2(runningBalance),
    };
  });

  return { account, beginningBalance, rows, endingBalance: round2(runningBalance) };
}
