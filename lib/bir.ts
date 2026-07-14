import { prisma } from "@/lib/prisma";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function num(d: unknown): number {
  return Number(d ?? 0);
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
 * Mirrors the manual's own documented behavior for this exact form,
 * quoted directly from the manual: "The system will only take up the
 * current transactions as the basis of computing Vat Payable. Any
 * adjustments coming from previous period will be manually encoded...
 * Type in the amount of adjustment in column 17A, observed that Vat
 * Payable is automatically adjusted." This function computes ONLY the
 * current period's figures — carried-over input tax is deliberately not
 * modeled here; it's a manual adjustment applied where this is displayed,
 * exactly as the original system does it.
 *
 * Known simplification: the manual's form splits purchases into Capital
 * Goods / Goods / Services (three categories) using a Tax Source field
 * captured at entry time. This schema has that field (`LedgerEntry.taxSource`)
 * but the journal entry screens don't populate it yet — see the README.
 * Until that's wired up, this only reliably separates Capital Goods
 * (via the debited account's FIXED_ASSET classification) from everything
 * else, rather than faking a Goods/Services split with no real data
 * behind it.
 */
/**
 * Range-based VAT return: same computation over an arbitrary period (used by
 * the monthly/quarterly/annual/custom filters). See getMonthlyVatReturn for
 * the manual-behavior notes.
 */
export async function getVatReturn(companyId: string, start: Date, end: Date): Promise<VatReturn> {
  const salesLines = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      postingDate: { gte: start, lte: end },
      journalType: { in: ["CASH_RECEIPT", "SALES_ON_ACCOUNT"] },
      creditAmount: { gt: 0 },
      vatType: { in: ["VAT_12", "ZERO_RATED", "VAT_EXEMPT"] },
    },
    include: { customer: true },
  });

  let vatableSalesPrivate = 0;
  let salesToGovernment = 0;
  let zeroRatedSales = 0;
  let exemptSales = 0;
  let outputTax = 0;

  for (const line of salesLines) {
    const net = num(line.netAmount);
    const vat = num(line.vatAmount);
    if (line.vatType === "VAT_12") {
      if (line.customer?.customerType === "GOVERNMENT") {
        salesToGovernment += net;
      } else {
        vatableSalesPrivate += net;
      }
      outputTax += vat;
    } else if (line.vatType === "ZERO_RATED") {
      zeroRatedSales += net;
    } else if (line.vatType === "VAT_EXEMPT") {
      exemptSales += net;
    }
  }

  const purchaseLines = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      postingDate: { gte: start, lte: end },
      journalType: { in: ["CASH_DISBURSEMENT", "PURCHASE_ON_ACCOUNT"] },
      debitAmount: { gt: 0 },
      vatType: "VAT_12",
    },
    include: { account: true },
  });

  let capitalGoodsPurchases = 0;
  let capitalGoodsInputTax = 0;
  let otherPurchases = 0;
  let otherInputTax = 0;

  for (const line of purchaseLines) {
    const net = num(line.netAmount);
    const vat = num(line.vatAmount);
    if (line.account.classification === "FIXED_ASSET") {
      capitalGoodsPurchases += net;
      capitalGoodsInputTax += vat;
    } else {
      otherPurchases += net;
      otherInputTax += vat;
    }
  }

  return {
    vatableSalesPrivate: round2(vatableSalesPrivate),
    salesToGovernment: round2(salesToGovernment),
    zeroRatedSales: round2(zeroRatedSales),
    exemptSales: round2(exemptSales),
    totalSales: round2(vatableSalesPrivate + salesToGovernment + zeroRatedSales + exemptSales),
    outputTax: round2(outputTax),
    capitalGoodsPurchases: round2(capitalGoodsPurchases),
    capitalGoodsInputTax: round2(capitalGoodsInputTax),
    otherPurchases: round2(otherPurchases),
    otherInputTax: round2(otherInputTax),
    totalCurrentInputTax: round2(capitalGoodsInputTax + otherInputTax),
  };
}

export async function getMonthlyVatReturn(companyId: string, year: number, month: number): Promise<VatReturn> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999); // last day of the month
  return getVatReturn(companyId, start, end);
}

/**
 * BIR Form 2550Q, Part IV — Details of VAT Computation (April 2024 ENCS).
 *
 * The ledger only auto-computes the lines it has real data for: VATable /
 * zero-rated / exempt sales and their output tax, and domestic purchases and
 * their input tax. Every other line (uncollected-receivables adjustments,
 * transitional/presumptive input tax, services by non-residents, importations,
 * amortized capital-goods deferrals, and the input-tax deduction rows) is a
 * manual entry, defaulting to zero — exactly the fields a preparer fills in on
 * the form. All the subtotals/totals are then derived here so the on-screen
 * report, the print-out and the Excel export stay identical.
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
