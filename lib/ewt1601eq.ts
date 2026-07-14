// Pure, client-safe BIR Form 1601-EQ (Quarterly Remittance Return of Creditable
// Income Taxes Withheld — Expanded), Part II — Computation of Tax.
//
// IMPORTANT: no prisma / next/headers import here, so client components can use
// these helpers directly. The server-only data fetch (getExpandedWithholding)
// lives in lib/ewt.ts and imports the types from here.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// One ATC line (items 13..18 on the form) — computed from the ledger.
export type EwtAtcRow = {
  atcCode: string;
  atcDescription: string;
  ratePercent: number;
  taxBase: number;
  taxWithheld: number;
};

export type ExpandedWithholding = {
  rows: EwtAtcRow[];
  totalWithheld: number; // item 19
};

// Manual entries: remittances (20-23) and penalties (26-28).
export type Ewt1601Manual = {
  l20: number; l21: number; l22: number; l23: number;
  l26: number; l27: number; l28: number;
};

export type Ewt1601Totals = {
  l19: number; l24: number; l25: number; l29: number; l30: number;
};

export const EWT_1601_MANUAL_KEYS: (keyof Ewt1601Manual)[] = ["l20", "l21", "l22", "l23", "l26", "l27", "l28"];

export function emptyEwt1601Manual(): Ewt1601Manual {
  return Object.fromEntries(EWT_1601_MANUAL_KEYS.map((k) => [k, 0])) as Ewt1601Manual;
}

export function computeEwt1601(totalWithheld: number, m: Ewt1601Manual): Ewt1601Totals {
  const l19 = round2(totalWithheld);
  const l24 = round2(m.l20 + m.l21 + m.l22 + m.l23);
  const l25 = round2(l19 - l24);
  const l29 = round2(m.l26 + m.l27 + m.l28);
  const l30 = round2(l25 + l29);
  return { l19, l24, l25, l29, l30 };
}

// Exact labels from BIR Form 1601-EQ, Part II (items 19-30). The ATC rows
// (13-18) are labelled by their ATC code, not here.
export const EWT_1601_LABELS: Record<string, string> = {
  "19": "Total Taxes Withheld for the Quarter (Sum of Items 13 to 18)",
  "20": "Less: Remittances Made: 1st Month of the Quarter",
  "21": "2nd Month of the Quarter",
  "22": "Tax Remitted in Return Previously Filed, if this is an amended return",
  "23": "Over-remittance from Previous Quarter of the same taxable year",
  "24": "Total Remittances Made (Sum of Items 20 to 23)",
  "25": "Tax Still Due/(Over-remittance) (Item 19 Less Item 24)",
  "26": "Add: Penalties — Surcharge",
  "27": "Interest",
  "28": "Compromise",
  "29": "Total Penalties (Sum of Items 26 to 28)",
  "30": "TOTAL AMOUNT STILL DUE /(Over-remittance) (Sum of Items 25 and 29)",
};
