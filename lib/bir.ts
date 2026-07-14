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
