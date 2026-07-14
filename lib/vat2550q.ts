// Pure, client-safe VAT return types + BIR 2550Q Part IV computation.
//
// IMPORTANT: this module must NOT import prisma (or anything that pulls in
// next/headers), so that client components can import computeVat2550Q / the
// labels directly. The server-only data fetch (getVatReturn) lives in
// lib/bir.ts, which imports the VatReturn type from here.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type VatReturn = {
  // Sales/receipts side
  vatableSalesPrivate: number;
  salesToGovernment: number;
  zeroRatedSales: number;
  exemptSales: number;
  totalSales: number;
  outputTax: number;
  // Purchases side
  capitalGoodsPurchases: number;
  capitalGoodsInputTax: number;
  otherPurchases: number;
  otherInputTax: number;
  totalCurrentInputTax: number;
};

/**
 * BIR Form 2550Q, Part IV — Details of VAT Computation (April 2024 ENCS).
 *
 * The ledger only auto-computes the lines it has real data for: VATable /
 * zero-rated / exempt sales and their output tax, and domestic purchases and
 * their input tax. Every other line (uncollected-receivables adjustments,
 * transitional/presumptive input tax, services by non-residents, importations,
 * amortized capital-goods deferrals, and the input-tax deduction rows) is a
 * manual entry, defaulting to zero. All the subtotals/totals are derived here
 * so the on-screen report, the print-out and the Excel export stay identical.
 */
export type Vat2550QManual = {
  l35: number; l36: number; // output tax adjustments
  l38: number; l39: number; l40: number; l41: number; l42: number; // allowable input tax
  l45A: number; l45B: number; l46A: number; l46B: number; l47A: number; l47B: number; l48A: number; l49A: number; // current transactions
  l52: number; l53: number; l54: number; l55: number; l56: number; l58: number; // adjustments/deductions
};

export type Vat2550QLines = {
  l31A: number; l31B: number; l32A: number; l33A: number; l34A: number; l34B: number; l37B: number;
  l43B: number;
  l44A: number; l44B: number; l50A: number; l50B: number; l51B: number;
  l57B: number; l59B: number; l60B: number; l61B: number;
};

export const VAT_2550Q_MANUAL_KEYS: (keyof Vat2550QManual)[] = [
  "l35", "l36", "l38", "l39", "l40", "l41", "l42",
  "l45A", "l45B", "l46A", "l46B", "l47A", "l47B", "l48A", "l49A",
  "l52", "l53", "l54", "l55", "l56", "l58",
];

export function emptyVat2550QManual(): Vat2550QManual {
  return Object.fromEntries(VAT_2550Q_MANUAL_KEYS.map((k) => [k, 0])) as Vat2550QManual;
}

export function computeVat2550Q(base: VatReturn, m: Vat2550QManual): Vat2550QLines {
  const l31A = round2(base.vatableSalesPrivate + base.salesToGovernment);
  const l31B = base.outputTax;
  const l32A = base.zeroRatedSales;
  const l33A = base.exemptSales;
  const l34A = round2(l31A + l32A + l33A);
  const l34B = l31B;
  const l37B = round2(l34B - m.l35 + m.l36);
  const l43B = round2(m.l38 + m.l39 + m.l40 + m.l41 + m.l42);
  const l44A = round2(base.capitalGoodsPurchases + base.otherPurchases);
  const l44B = base.totalCurrentInputTax;
  const l50A = round2(l44A + m.l45A + m.l46A + m.l47A + m.l48A + m.l49A);
  const l50B = round2(l44B + m.l45B + m.l46B + m.l47B);
  const l51B = round2(l43B + l50B);
  const l57B = round2(m.l52 + m.l53 + m.l54 + m.l55 + m.l56);
  const l59B = round2(l57B + m.l58);
  const l60B = round2(l51B - l59B);
  const l61B = round2(l37B - l60B);
  return { l31A, l31B, l32A, l33A, l34A, l34B, l37B, l43B, l44A, l44B, l50A, l50B, l51B, l57B, l59B, l60B, l61B };
}

// Exact line labels from BIR Form 2550Q (April 2024 ENCS), Part IV. Line 61 is
// rendered specially (Net VAT Payable vs Excess Input Tax) so it's omitted here.
export const VAT_2550Q_LABELS: Record<string, string> = {
  "31": "VATable Sales",
  "32": "Zero-Rated Sales",
  "33": "Exempt Sales",
  "34": "Total Sales and Output Tax Due (Sum of Items 31A to 33A)(Item 31B)",
  "35": "Less: Output VAT on Uncollected Receivables",
  "36": "Add: Output VAT on Recovered Uncollected Receivables Previously Deducted",
  "37": "Total Adjusted Output Tax Due (Item 34B Less Item 35B Add Item 36B)",
  "38": "Input Tax Carried Over from Previous Quarter",
  "39": "Input Tax Deferred on Capital Goods Exceeding 1 Million from Previous Quarter",
  "40": "Transitional Input Tax",
  "41": "Presumptive Input Tax",
  "42": "Others (Specify)",
  "43": "Total (Sum of Items 38B to 42B)",
  "44": "Domestic Purchases",
  "45": "Services Rendered by Non-Residents",
  "46": "Importations",
  "47": "Others (Specify)",
  "48": "Domestic Purchases with No Input Tax",
  "49": "VAT-Exempt Importations",
  "50": "Total Current Purchases/Input Tax (Sum of Items 44A to 49A)(Sum of Items 44B to 47B)",
  "51": "Total Available Input Tax (Sum of Items 43B and 50B)",
  "52": "Input Tax on Purchases/Importation of Capital Goods exceeding P1 Million deferred for the succeeding period",
  "53": "Input Tax Attributable to VAT-Exempt Sales",
  "54": "VAT Refund/TCC Claimed",
  "55": "Input VAT on Unpaid Payables",
  "56": "Others (Specify)",
  "57": "Total Deductions from Input Tax (Sum of Items 52B to 56B)",
  "58": "Add: Input VAT on Settled Unpaid Payables Previously Deducted",
  "59": "Adjusted Deductions from Input Tax (Sum of Items 57B and 58B)",
  "60": "Total Allowable Input Tax (Item 51B Less Item 59B)",
};

export const VAT_2550Q_SECTIONS = {
  sales: "Total Sales and Output Tax",
  allowableInput: "Less: Allowable Input Tax",
  currentTransactions: "Current Transactions",
  adjustments: "Less: Adjustment/Deductions from Input Tax",
};
