// "Ask ARbi" — pure, client-safe report registry + a rule-based intent parser.
// No prisma import, so both the client (for example prompts) and the server
// (for resolution) can use it. The server-only report execution lives in
// lib/askArbiRun.ts and the optional Claude fallback in lib/askArbiLLM.ts.

export type ReportCategory = "journal" | "financial" | "bir";

export type AskReport = {
  id: string;
  label: string;
  category: ReportCategory;
  href: string; // full report page to deep-link to
  keywords: string[]; // lowercase phrases for rule-based matching
};

export const ASK_REPORTS: AskReport[] = [
  // Journals (Books of Accounts)
  { id: "cash-disbursement", label: "Cash Disbursement Journal", category: "journal", href: "/books/cash-disbursement", keywords: ["cash disbursement", "disbursement", "cdj", "cash out", "payments journal"] },
  { id: "cash-receipts", label: "Cash Receipts Journal", category: "journal", href: "/books/cash-receipts", keywords: ["cash receipt", "cash receipts", "receipts journal", "crj", "cash in", "collections"] },
  { id: "sales", label: "Sales Journal", category: "journal", href: "/books/sales", keywords: ["sales journal", "sales book", "sales subsidiary", "sales register"] },
  { id: "purchases", label: "Purchase Journal", category: "journal", href: "/books/purchases", keywords: ["purchase journal", "purchases journal", "purchase book", "purchase subsidiary", "purchase register"] },
  { id: "general-journal", label: "General Journal", category: "journal", href: "/books/general-journal", keywords: ["general journal", "journal voucher", "gj book"] },
  // Financial statements
  { id: "trial-balance", label: "Trial Balance", category: "financial", href: "/reports/trial-balance", keywords: ["trial balance", "trial-balance", " tb "] },
  { id: "income-statement", label: "Income Statement", category: "financial", href: "/reports/income-statement", keywords: ["income statement", "profit and loss", "profit & loss", "p&l", "pnl", "statement of income", "profit or loss"] },
  { id: "balance-sheet", label: "Balance Sheet", category: "financial", href: "/reports/balance-sheet", keywords: ["balance sheet", "statement of financial position", "financial position"] },
  { id: "cash-flow", label: "Cash Flow Statement", category: "financial", href: "/reports/cash-flow-statement", keywords: ["cash flow", "cashflow", "statement of cash flows"] },
  { id: "equity", label: "Statement of Changes in Equity", category: "financial", href: "/reports/equity-statement", keywords: ["equity statement", "changes in equity", "statement of equity", "owner's equity", "owners equity"] },
  // BIR reports
  { id: "vat-return", label: "VAT Return", category: "bir", href: "/reports/bir/vat-return", keywords: ["vat return", "2550q", "2550m", "2550", "value added tax return", "vat form"] },
  { id: "expanded-withholding", label: "Expanded Withholding Tax", category: "bir", href: "/reports/bir/expanded-withholding", keywords: ["expanded withholding", "1601eq", "1601-eq", "1601", "ewt", "withholding tax return"] },
  { id: "sls", label: "Summary List of Sales (SLS)", category: "bir", href: "/reports/bir/sls", keywords: ["summary list of sales", "sls"] },
  { id: "slp", label: "Summary List of Purchases (SLP)", category: "bir", href: "/reports/bir/slp", keywords: ["summary list of purchases", "slp"] },
  { id: "sli", label: "Summary List of Importations (SLI)", category: "bir", href: "/reports/bir/sli", keywords: ["summary list of importations", "sli", "importations list"] },
];

export const ASK_REPORT_IDS = ASK_REPORTS.map((r) => r.id);

export type AskIntent = {
  reportId: string | null;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  periodLabel: string;
};

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function monthName(m: number) {
  return MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1);
}
function lastOfMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}

/** Rule-based report matcher — picks the report whose longest keyword appears
 * in the text (most specific wins). Returns null if nothing matches. */
export function matchReport(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  let bestId: string | null = null;
  let bestLen = 0;
  for (const r of ASK_REPORTS) {
    for (const kw of r.keywords) {
      if (t.includes(kw) && kw.trim().length > bestLen) {
        bestLen = kw.trim().length;
        bestId = r.id;
      }
    }
  }
  return bestId;
}

/** Rule-based date-range parser. Understands: this/current/last month,
 * this/last/current quarter, Q1-Q4 [year], this/current year / annual / YTD,
 * year <YYYY>, a month name [year], today, and an explicit YYYY-MM-DD to
 * YYYY-MM-DD range. Defaults to the current month. */
export function parseDateRange(text: string, now: Date): { from: string; to: string; periodLabel: string } {
  const t = text.toLowerCase();
  const y = now.getFullYear();

  // Explicit YYYY-MM-DD to YYYY-MM-DD
  const range = t.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-|through|until)\s*(\d{4}-\d{2}-\d{2})/);
  if (range) return { from: range[1], to: range[2], periodLabel: `${range[1]} to ${range[2]}` };

  // Quarter: Q1 2026 / this quarter / last quarter
  const qMatch = t.match(/\bq([1-4])\b/);
  const quarterFromNum = (q: number, yr: number) => {
    const sm = (q - 1) * 3;
    return { from: `${yr}-${p2(sm + 1)}-01`, to: `${yr}-${p2(sm + 3)}-${p2(lastOfMonth(yr, sm + 2))}`, periodLabel: `Q${q} ${yr}` };
  };
  if (qMatch) {
    const yr = t.match(/\b(20\d{2})\b/) ? Number(t.match(/\b(20\d{2})\b/)![1]) : y;
    return quarterFromNum(Number(qMatch[1]), yr);
  }
  if (/(this|current)\s+quarter/.test(t)) return quarterFromNum(Math.floor(now.getMonth() / 3) + 1, y);
  if (/last\s+quarter/.test(t)) {
    const cq = Math.floor(now.getMonth() / 3) + 1;
    return cq === 1 ? quarterFromNum(4, y - 1) : quarterFromNum(cq - 1, y);
  }

  // Year: this/current year, annual, YTD, year 2026
  const yearMatch = t.match(/\b(20\d{2})\b/);
  if (/year\s+to\s+date|\bytd\b/.test(t)) return { from: `${y}-01-01`, to: iso(now), periodLabel: `Year to date ${y}` };
  if (/(this|current)\s+year|annual|whole\s+year|full\s+year/.test(t)) return { from: `${y}-01-01`, to: `${y}-12-31`, periodLabel: `Year ${y}` };
  if (/last\s+year|previous\s+year/.test(t)) return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, periodLabel: `Year ${y - 1}` };
  if (yearMatch && /\byear\b/.test(t)) {
    const yr = Number(yearMatch[1]);
    return { from: `${yr}-01-01`, to: `${yr}-12-31`, periodLabel: `Year ${yr}` };
  }

  // Today
  if (/\btoday\b/.test(t)) return { from: iso(now), to: iso(now), periodLabel: `Today (${iso(now)})` };

  // Month name (optionally with year)
  const mIdx = MONTHS.findIndex((m) => t.includes(m));
  if (mIdx >= 0) {
    const yr = yearMatch ? Number(yearMatch[1]) : y;
    return { from: `${yr}-${p2(mIdx + 1)}-01`, to: `${yr}-${p2(mIdx + 1)}-${p2(lastOfMonth(yr, mIdx))}`, periodLabel: `${monthName(mIdx)} ${yr}` };
  }

  // Last month
  if (/last\s+month|previous\s+month/.test(t)) {
    const d = new Date(y, now.getMonth() - 1, 1);
    const my = d.getFullYear();
    const m0 = d.getMonth();
    return { from: `${my}-${p2(m0 + 1)}-01`, to: `${my}-${p2(m0 + 1)}-${p2(lastOfMonth(my, m0))}`, periodLabel: `${monthName(m0)} ${my}` };
  }

  // Default / "this/current month" → the full current month
  const m0 = now.getMonth();
  return { from: `${y}-${p2(m0 + 1)}-01`, to: `${y}-${p2(m0 + 1)}-${p2(lastOfMonth(y, m0))}`, periodLabel: `${monthName(m0)} ${y}` };
}

/** Full rule-based parse: report + date range. reportId is null when no report
 * keyword matched (the caller may then fall back to the LLM). */
export function parseAskArbi(query: string, now: Date): AskIntent {
  const reportId = matchReport(query);
  const { from, to, periodLabel } = parseDateRange(query, now);
  return { reportId, from, to, periodLabel };
}

export const ASK_EXAMPLES = [
  "Generate a Cash Disbursement report for the current month",
  "Show me the Income Statement for this year",
  "VAT Return for Q2 2026",
  "Trial Balance as of today",
  "Purchase Journal for last month",
];
