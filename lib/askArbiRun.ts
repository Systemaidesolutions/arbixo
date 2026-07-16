import { getJournalBook } from "@/lib/booksOfAccounts";
import { getTrialBalance, getIncomeStatement, getCashFlowStatement, getEquityStatement } from "@/lib/reports";
import { getVatReturn } from "@/lib/bir";
import { computeVat2550Q, emptyVat2550QManual } from "@/lib/vat2550q";
import { getExpandedWithholding } from "@/lib/ewt";
import { formatPeso } from "@/lib/format";
import type { JournalType } from "@prisma/client";

export type AskTable = {
  columns: string[];
  align?: ("left" | "right")[];
  rows: (string | number | null)[][];
  totals?: (string | number | null)[];
  note?: string;
};

const money = (n: number) => (n ? formatPeso(n) : "");
const start = (d: string) => new Date(`${d}T00:00:00`);
const end = (d: string) => new Date(`${d}T23:59:59.999`);
const ROW_CAP = 200;

const JOURNAL_TYPES: Record<string, JournalType[]> = {
  "cash-disbursement": ["CASH_DISBURSEMENT"],
  "cash-receipts": ["CASH_RECEIPT"],
  sales: ["SALES_ON_ACCOUNT"],
  purchases: ["PURCHASE_ON_ACCOUNT"],
  "general-journal": ["GENERAL_JOURNAL"],
};

/**
 * Runs a report and returns a flat preview table, or null for reports that are
 * only deep-linked (the caller then just offers the "Open report" link).
 */
export async function runAskReport(companyId: string, reportId: string, from: string, to: string): Promise<AskTable | null> {
  if (JOURNAL_TYPES[reportId]) {
    const book = await getJournalBook(companyId, JOURNAL_TYPES[reportId], start(from), end(to));
    const rows = book.lines.slice(0, ROW_CAP).map((l) => [
      new Date(l.postingDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
      l.documentNo,
      `${l.accountCode} ${l.accountTitle}`,
      l.counterparty ?? "",
      money(l.debit),
      money(l.credit),
    ]);
    return {
      columns: ["Date", "Doc No.", "Account", "Party", "Debit", "Credit"],
      align: ["left", "left", "left", "left", "right", "right"],
      rows,
      totals: ["", "", "", "TOTAL", money(book.totalDebit), money(book.totalCredit)],
      note: book.lines.length > ROW_CAP ? `Showing the first ${ROW_CAP} of ${book.lines.length} lines — open the full report for all.` : undefined,
    };
  }

  if (reportId === "trial-balance") {
    const tb = await getTrialBalance(companyId, { mode: "NET_CHANGE", dateFrom: start(from), dateTo: end(to) });
    return {
      columns: ["Code", "Account", "Debit", "Credit"],
      align: ["left", "left", "right", "right"],
      rows: tb.rows.map((r) => [r.code, r.title, money(r.debit), money(r.credit)]),
      totals: ["", "TOTAL", money(tb.totalDebit), money(tb.totalCredit)],
    };
  }

  if (reportId === "income-statement") {
    const is = await getIncomeStatement(companyId, start(from), end(to));
    const rows: (string | number | null)[][] = [];
    rows.push(["REVENUE", ""]);
    for (const l of is.revenue) rows.push([`  ${l.code} ${l.title}`, money(l.amount)]);
    rows.push(["Total revenue", money(is.totalRevenue)]);
    rows.push(["EXPENSES", ""]);
    for (const l of is.expense) rows.push([`  ${l.code} ${l.title}`, money(l.amount)]);
    rows.push(["Total expenses", money(is.totalExpense)]);
    return {
      columns: ["Account", "Amount"],
      align: ["left", "right"],
      rows,
      totals: [is.netIncome >= 0 ? "NET INCOME" : "NET LOSS", money(Math.abs(is.netIncome))],
    };
  }

  if (reportId === "cash-flow") {
    const cf = await getCashFlowStatement(companyId, start(from), end(to));
    const rows: (string | number | null)[][] = [
      ["Profit for the year", money(cf.netIncome)],
      ["Adjustments for non-cash income and expenses", money(cf.operatingAdjustmentsTotal)],
      ["Net cash from operating activities", money(cf.netOperating)],
    ];
    if (cf.investing.length) rows.push(["Net cash from investing activities", money(cf.netInvesting)]);
    rows.push([cf.netFinancing < 0 ? "Net cash used in financing activities" : "Net cash from financing activities", money(cf.netFinancing)]);
    rows.push(["Net increase (decrease) in cash", money(cf.netChange)]);
    rows.push(["Cash at beginning of period", money(cf.beginningCash)]);
    return {
      columns: ["Account", "Amount"],
      align: ["left", "right"],
      rows,
      totals: ["CASH AT END OF PERIOD", money(cf.endingCash)],
    };
  }

  if (reportId === "equity") {
    const eq = await getEquityStatement(companyId, start(from), end(to));
    return {
      columns: ["", "Amount"],
      align: ["left", "right"],
      rows: [
        ["Beginning equity", money(eq.beginningEquity)],
        [eq.netIncome >= 0 ? "Net income" : "Net loss", money(Math.abs(eq.netIncome))],
        ["Net contributions / (drawings)", money(eq.netContributions)],
      ],
      totals: ["ENDING EQUITY", money(eq.endingEquity)],
    };
  }

  if (reportId === "vat-return") {
    const base = await getVatReturn(companyId, start(from), end(to));
    const L = computeVat2550Q(base, emptyVat2550QManual());
    return {
      columns: ["#", "Details of VAT Computation", "Amount"],
      align: ["left", "left", "right"],
      rows: [
        ["31", "VATable Sales / Output Tax", `${money(L.l31A)} / ${money(L.l31B)}`],
        ["32", "Zero-Rated Sales", money(L.l32A)],
        ["33", "Exempt Sales", money(L.l33A)],
        ["34", "Total Sales and Output Tax Due", money(L.l34A)],
        ["44", "Domestic Purchases / Input Tax", `${money(L.l44A)} / ${money(L.l44B)}`],
        ["60", "Total Allowable Input Tax", money(L.l60B)],
      ],
      totals: ["61", L.l61B >= 0 ? "Net VAT Payable" : "Excess Input Tax", money(Math.abs(L.l61B))],
    };
  }

  if (reportId === "expanded-withholding") {
    const ewt = await getExpandedWithholding(companyId, start(from), end(to));
    return {
      columns: ["ATC", "Tax Base", "Rate (%)", "Tax Withheld"],
      align: ["left", "right", "right", "right"],
      rows: ewt.rows.map((r) => [`${r.atcCode}${r.atcDescription ? ` — ${r.atcDescription}` : ""}`, money(r.taxBase), r.ratePercent.toFixed(2), money(r.taxWithheld)]),
      totals: ["TOTAL WITHHELD", "", "", money(ewt.totalWithheld)],
    };
  }

  // balance-sheet, sls, slp, sli → deep-link only for now.
  return null;
}
