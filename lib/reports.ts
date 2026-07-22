import { prisma } from "@/lib/prisma";
import { branchWhere, type BranchScope } from "@/lib/branchScope";
import type { Account, AccountClassification } from "@prisma/client";

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
  dateFilter: { lte: Date } | { gte: Date; lte: Date },
  branch?: BranchScope
): Promise<Map<string, number>> {
  const grouped = await prisma.ledgerEntry.groupBy({
    by: ["accountId"],
    where: { companyId, isCancelled: false, postingDate: dateFilter, ...branchWhere(branch ?? null) },
    _sum: { debitAmount: true, creditAmount: true },
  });
  return new Map(grouped.map((g) => [g.accountId, num(g._sum.debitAmount) - num(g._sum.creditAmount)]));
}

/**
 * Account opening balances are company-level, so they belong to the head
 * office: consolidated and head-office reports fold them in, other branches
 * don't (otherwise every branch would restate the same opening figure and the
 * branches would no longer sum to the consolidated total).
 */
function includeOpeningBalances(branch?: BranchScope): boolean {
  return !branch || branch.includeUntagged;
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
  opts: { mode: TrialBalanceMode; asOfDate?: Date; dateFrom?: Date; dateTo?: Date; branch?: BranchScope }
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> {
  const accounts = await prisma.account.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  const dateFilter =
    opts.mode === "YEAR_TO_DATE" ? { lte: opts.asOfDate! } : { gte: opts.dateFrom!, lte: opts.dateTo! };
  const movements = await getAccountNetMovements(companyId, dateFilter, opts.branch);
  const withOpening = includeOpeningBalances(opts.branch);

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of accounts) {
    const netMovement = movements.get(account.id) ?? 0;
    const raw =
      opts.mode === "YEAR_TO_DATE" && withOpening
        ? netMovement + openingBalanceSigned(account)
        : netMovement;

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
  dateTo: Date,
  branch?: BranchScope
): Promise<IncomeStatement> {
  const accounts = await prisma.account.findMany({
    where: { companyId, classification: { in: ["REVENUE", "EXPENSE"] } },
    orderBy: { code: "asc" },
  });
  const movements = await getAccountNetMovements(companyId, { gte: dateFrom, lte: dateTo }, branch);

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

export type EquityStatement = {
  beginningEquity: number;
  netIncome: number;
  netContributions: number; // capital contributed less drawings, posted during the period
  endingEquity: number;
};

// Statement of Changes in Equity: opening equity balance + net income for the
// period + net owner contributions/(drawings) posted during the period.
export async function getEquityStatement(companyId: string, dateFrom: Date, dateTo: Date, branch?: BranchScope): Promise<EquityStatement> {
  const dayBefore = new Date(dateFrom);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const [beginTB, endTB, is] = await Promise.all([
    getTrialBalance(companyId, { mode: "YEAR_TO_DATE", asOfDate: dayBefore, branch }),
    getTrialBalance(companyId, { mode: "YEAR_TO_DATE", asOfDate: dateTo, branch }),
    getIncomeStatement(companyId, dateFrom, dateTo, branch),
  ]);

  const equityBalance = (rows: TrialBalanceRow[]) =>
    rows
      .filter((r) => r.classification === "EQUITY_DOES_NOT_CLOSE" || r.classification === "EQUITY_GETS_CLOSED")
      .reduce((s, r) => s + (r.credit - r.debit), 0);

  const beginningEquity = round2(equityBalance(beginTB.rows));
  const netContributions = round2(equityBalance(endTB.rows) - beginningEquity);
  const netIncome = is.netIncome;
  const endingEquity = round2(beginningEquity + netContributions + netIncome);
  return { beginningEquity, netIncome, netContributions, endingEquity };
}

export type CashFlowLine = { code: string | null; title: string; amount: number };

export type CashFlowStatement = {
  netIncome: number;
  operatingAdjustments: CashFlowLine[];
  operatingAdjustmentsTotal: number;
  netOperating: number;
  investing: CashFlowLine[];
  netInvesting: number;
  financing: CashFlowLine[];
  netFinancing: number;
  netChange: number;
  beginningCash: number;
  endingCash: number;
};

// Indirect-method Statement of Cash Flows. Built purely from account movements:
// because every posted document is balanced, the sum of all accounts' net
// debit movements is zero, so the cash movement equals minus the sum of every
// non-cash account's movement. Each non-cash account therefore contributes
// -(its net debit movement) as a cash effect, grouped by activity. Net income
// is shown separately (it is -(revenue+expense movements)). This ties out to
// the actual change in the cash accounts exactly.
export async function getCashFlowStatement(
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
  branch?: BranchScope
): Promise<CashFlowStatement> {
  const dayBefore = new Date(dateFrom);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const [netChange, beginTB, endTB, is] = await Promise.all([
    getTrialBalance(companyId, { mode: "NET_CHANGE", dateFrom, dateTo, branch }),
    getTrialBalance(companyId, { mode: "YEAR_TO_DATE", asOfDate: dayBefore, branch }),
    getTrialBalance(companyId, { mode: "YEAR_TO_DATE", asOfDate: dateTo, branch }),
    getIncomeStatement(companyId, dateFrom, dateTo, branch),
  ]);

  const CASH: AccountClassification[] = ["CASH_IN_BANK", "CASH_ON_HAND"];
  const OPERATING: AccountClassification[] = [
    "ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET", "INVENTORY",
    "ACCUMULATED_DEPRECIATION", "ACCOUNTS_PAYABLE", "OTHER_CURRENT_LIABILITY",
  ];
  const INVESTING: AccountClassification[] = ["FIXED_ASSET", "OTHER_ASSET"];
  const FINANCING: AccountClassification[] = ["LONG_TERM_PAYABLE", "EQUITY_DOES_NOT_CLOSE", "EQUITY_GETS_CLOSED"];

  const cashBalance = (rows: TrialBalanceRow[]) =>
    rows.filter((r) => (CASH as string[]).includes(r.classification)).reduce((s, r) => s + (r.debit - r.credit), 0);
  const beginningCash = round2(cashBalance(beginTB.rows));
  const endingCash = round2(cashBalance(endTB.rows));

  // Cash effect of an account's period movement = -(debit - credit).
  const pick = (classes: AccountClassification[]): CashFlowLine[] =>
    netChange.rows
      .filter((r) => (classes as string[]).includes(r.classification))
      .map((r) => ({ code: r.code, title: r.title, amount: round2(-(r.debit - r.credit)) }))
      .filter((l) => Math.abs(l.amount) >= 0.005);
  const sum = (ls: CashFlowLine[]) => round2(ls.reduce((s, l) => s + l.amount, 0));

  const operatingAdjustments = pick(OPERATING);
  const investing = pick(INVESTING);
  const financing = pick(FINANCING);
  const operatingAdjustmentsTotal = sum(operatingAdjustments);
  const netOperating = round2(is.netIncome + operatingAdjustmentsTotal);
  const netInvesting = sum(investing);
  const netFinancing = sum(financing);
  const netChangeTotal = round2(netOperating + netInvesting + netFinancing);

  return {
    netIncome: is.netIncome,
    operatingAdjustments,
    operatingAdjustmentsTotal,
    netOperating,
    investing,
    netInvesting,
    financing,
    netFinancing,
    netChange: netChangeTotal,
    beginningCash,
    endingCash,
  };
}

const ASSET_CLASSIFICATIONS: AccountClassification[] = [
  "CASH_IN_BANK", "CASH_ON_HAND", "ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET",
  "INVENTORY", "FIXED_ASSET", "ACCUMULATED_DEPRECIATION", "OTHER_ASSET",
];
const LIABILITY_CLASSIFICATIONS: AccountClassification[] = [
  "ACCOUNTS_PAYABLE", "OTHER_CURRENT_LIABILITY", "LONG_TERM_PAYABLE",
];
const EQUITY_CLASSIFICATIONS: AccountClassification[] = ["EQUITY_DOES_NOT_CLOSE", "EQUITY_GETS_CLOSED"];

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
  fiscalYearStart: Date,
  branch?: BranchScope
): Promise<BalanceSheet> {
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      classification: { in: [...ASSET_CLASSIFICATIONS, ...LIABILITY_CLASSIFICATIONS, ...EQUITY_CLASSIFICATIONS] },
    },
    orderBy: { code: "asc" },
  });
  const movements = await getAccountNetMovements(companyId, { lte: asOfDate }, branch);
  const withOpening = includeOpeningBalances(branch);

  const assets: BalanceSheetLine[] = [];
  const liabilities: BalanceSheetLine[] = [];
  const equity: BalanceSheetLine[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquityRecorded = 0;

  for (const account of accounts) {
    const netMovement = movements.get(account.id) ?? 0;
    const raw = withOpening ? netMovement + openingBalanceSigned(account) : netMovement;
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
    getIncomeStatement(companyId, earliestDate, asOfDate, branch),
    getIncomeStatement(companyId, fiscalYearStart, asOfDate, branch),
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

// ------------------------------------------------------------
// Dashboard "At a Glance" summary — the headline figures shown on the
// subscriber home page, each with a month-over-month change.
// ------------------------------------------------------------
const CASH_CLASSIFICATIONS: AccountClassification[] = ["CASH_IN_BANK", "CASH_ON_HAND"];

export type DashboardMetric = { value: number; changePct: number | null };
export type DashboardSummary = {
  totalCash: DashboardMetric;
  accountsReceivable: DashboardMetric;
  accountsPayable: DashboardMetric;
  grossSales: DashboardMetric; // this month's revenue
  netProfit: DashboardMetric; // this month's net income
};

function changePct(current: number, prior: number): number | null {
  // No meaningful percentage when there was nothing to compare against.
  if (Math.abs(prior) < 0.005) return null;
  return round2(((current - prior) / Math.abs(prior)) * 100);
}

export async function getDashboardSummary(
  companyId: string,
  now: Date = new Date()
): Promise<DashboardSummary> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Last moment of the previous month.
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const accounts = await prisma.account.findMany({
    where: { companyId },
    select: { id: true, classification: true, normalBalance: true, openingBalance: true },
  });

  const [movNow, movPrior, isThisMonth, isLastMonth] = await Promise.all([
    getAccountNetMovements(companyId, { lte: now }),
    getAccountNetMovements(companyId, { lte: lastMonthEnd }),
    getIncomeStatement(companyId, monthStart, now),
    getIncomeStatement(companyId, lastMonthStart, lastMonthEnd),
  ]);

  // Debit-positive YTD balance summed across accounts of the given
  // classifications (opening balance + all movement up to the cutoff).
  function classSum(classes: AccountClassification[], mov: Map<string, number>): number {
    let s = 0;
    for (const a of accounts) {
      if (!classes.includes(a.classification)) continue;
      s += (mov.get(a.id) ?? 0) + openingBalanceSigned(a);
    }
    return round2(s);
  }

  const cashNow = classSum(CASH_CLASSIFICATIONS, movNow);
  const cashPrior = classSum(CASH_CLASSIFICATIONS, movPrior);
  const arNow = classSum(["ACCOUNTS_RECEIVABLE"], movNow);
  const arPrior = classSum(["ACCOUNTS_RECEIVABLE"], movPrior);
  // Payables are credit-normal, so flip the sign to show a positive owed amount.
  const apNow = round2(-classSum(["ACCOUNTS_PAYABLE"], movNow));
  const apPrior = round2(-classSum(["ACCOUNTS_PAYABLE"], movPrior));

  return {
    totalCash: { value: cashNow, changePct: changePct(cashNow, cashPrior) },
    accountsReceivable: { value: arNow, changePct: changePct(arNow, arPrior) },
    accountsPayable: { value: apNow, changePct: changePct(apNow, apPrior) },
    grossSales: {
      value: isThisMonth.totalRevenue,
      changePct: changePct(isThisMonth.totalRevenue, isLastMonth.totalRevenue),
    },
    netProfit: {
      value: isThisMonth.netIncome,
      changePct: changePct(isThisMonth.netIncome, isLastMonth.netIncome),
    },
  };
}

// Per-account (or per-line) detail behind each dashboard tile, so clicking a
// tile can reveal exactly what makes up the figure. Each metric's lines sum to
// that tile's value.
export type DashboardBreakdownLine = { code: string | null; title: string; amount: number };
export type DashboardBreakdowns = {
  totalCash: DashboardBreakdownLine[];
  accountsReceivable: DashboardBreakdownLine[];
  accountsPayable: DashboardBreakdownLine[];
  grossSales: DashboardBreakdownLine[];
  netProfit: DashboardBreakdownLine[];
};

export async function getDashboardBreakdowns(
  companyId: string,
  now: Date = new Date()
): Promise<DashboardBreakdowns> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [accounts, movNow, isThisMonth] = await Promise.all([
    prisma.account.findMany({
      where: { companyId },
      select: { id: true, code: true, title: true, classification: true, normalBalance: true, openingBalance: true },
    }),
    getAccountNetMovements(companyId, { lte: now }),
    getIncomeStatement(companyId, monthStart, now),
  ]);

  // Debit-positive YTD balance per account of the given classifications,
  // dropping accounts with a zero balance.
  function perAccount(classes: AccountClassification[], sign: 1 | -1): DashboardBreakdownLine[] {
    return accounts
      .filter((a) => classes.includes(a.classification))
      .map((a) => ({
        code: a.code,
        title: a.title,
        amount: round2(sign * ((movNow.get(a.id) ?? 0) + openingBalanceSigned(a))),
      }))
      .filter((l) => Math.abs(l.amount) >= 0.005)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }

  return {
    totalCash: perAccount(CASH_CLASSIFICATIONS, 1),
    accountsReceivable: perAccount(["ACCOUNTS_RECEIVABLE"], 1),
    // Payables are credit-normal — flip the sign so lines show as positive owed.
    accountsPayable: perAccount(["ACCOUNTS_PAYABLE"], -1),
    grossSales: isThisMonth.revenue.map((l) => ({ code: l.code, title: l.title, amount: l.amount })),
    // Net profit = revenue (positive) less expenses (shown negative); the
    // lines sum to the tile's net figure.
    netProfit: [
      ...isThisMonth.revenue.map((l) => ({ code: l.code, title: l.title, amount: l.amount })),
      ...isThisMonth.expense.map((l) => ({ code: l.code, title: l.title, amount: round2(-l.amount) })),
    ],
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
  dateTo: Date,
  branch?: BranchScope
): Promise<{ beginningBalance: number; rows: SubsidiaryLedgerRow[]; endingBalance: number }> {
  const classification = partyType === "CUSTOMER" ? "ACCOUNTS_RECEIVABLE" : "ACCOUNTS_PAYABLE";
  const partyFilter = partyType === "CUSTOMER" ? { customerId: partyId } : { vendorId: partyId };
  const branchFilter = branchWhere(branch ?? null);

  const [priorAgg, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        companyId,
        isCancelled: false,
        ...partyFilter,
        ...branchFilter,
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
        ...branchFilter,
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
  dateTo: Date,
  branch?: BranchScope
): Promise<{ account: Account; beginningBalance: number; rows: GeneralLedgerRow[]; endingBalance: number }> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.companyId !== companyId) {
    throw new Error("Account not found");
  }
  const branchFilter = branchWhere(branch ?? null);

  const [priorAgg, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { companyId, accountId, isCancelled: false, ...branchFilter, postingDate: { lt: dateFrom } },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { companyId, accountId, isCancelled: false, ...branchFilter, postingDate: { gte: dateFrom, lte: dateTo } },
      orderBy: [{ postingDate: "asc" }, { entryNo: "asc" }],
    }),
  ]);

  let runningBalance =
    (includeOpeningBalances(branch) ? openingBalanceSigned(account) : 0) +
    num(priorAgg._sum.debitAmount) -
    num(priorAgg._sum.creditAmount);
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
