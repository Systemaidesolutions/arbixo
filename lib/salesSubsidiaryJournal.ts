import { prisma } from "@/lib/prisma";
import { partyName } from "@/lib/slsp";

// VAT Sales Subsidiary Journal — one row per sales invoice (cash sales and
// sales on account that carry VAT), with the BIR VAT breakdown: exempt / 12% /
// zero-rated sales, output tax, total invoice, a goods-vs-service split, and
// the cash/account term.

function num(d: unknown): number {
  return Number(d ?? 0);
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type SalesSubsidiaryRow = {
  key: string;
  postingDate: string;
  documentNo: string; // Invoice number
  buyerName: string;
  buyerAddress: string;
  vatRegNo: string; // buyer TIN
  exempt: number; // Sales Exempted (net)
  vatable12: number; // Taxable Sales — 12% (net)
  zeroRated: number; // Taxable Sales — Zero Rated (net)
  outputTax: number; // VAT Output Tax
  totalInvoice: number; // Total Invoice Amount (gross)
  local: number; // Classification of Sales — Local (goods)
  service: number; // Classification of Sales — Service
  terms: "Cash" | "Account";
};

export type SalesSubsidiaryTotals = {
  exempt: number;
  vatable12: number;
  zeroRated: number;
  outputTax: number;
  totalInvoice: number;
  local: number;
  service: number;
};

export type SalesSubsidiaryJournal = {
  rows: SalesSubsidiaryRow[];
  totals: SalesSubsidiaryTotals;
};

export async function getSalesSubsidiaryJournal(
  companyId: string,
  from: Date,
  to: Date
): Promise<SalesSubsidiaryJournal> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      postingDate: { gte: from, lte: to },
      // Actual sales lines: money coming in (credit) with a VAT classification.
      // A plain collection of a receivable has no vatType, so it's excluded.
      journalType: { in: ["SALES_ON_ACCOUNT", "CASH_RECEIPT"] },
      creditAmount: { gt: 0 },
      vatType: { in: ["VAT_12", "ZERO_RATED", "VAT_EXEMPT"] },
    },
    include: { customer: true },
    orderBy: [{ postingDate: "asc" }, { documentNo: "asc" }, { lineNo: "asc" }],
  });

  const map = new Map<string, SalesSubsidiaryRow>();
  for (const e of entries) {
    const key = `${e.journalType}|${e.documentNo}`;
    let row = map.get(key);
    if (!row) {
      const c = e.customer;
      row = {
        key,
        postingDate: e.postingDate.toISOString(),
        documentNo: e.documentNo,
        buyerName: c ? partyName(c) : "",
        buyerAddress: c ? [c.address, c.barangay, c.city, c.province, c.zipCode].filter(Boolean).join(", ") : "",
        vatRegNo: c?.tin ?? "",
        exempt: 0,
        vatable12: 0,
        zeroRated: 0,
        outputTax: 0,
        totalInvoice: 0,
        local: 0,
        service: 0,
        terms: e.journalType === "CASH_RECEIPT" ? "Cash" : "Account",
      };
      map.set(key, row);
    }
    const sign = e.isReturn ? -1 : 1;
    const net = num(e.netAmount) * sign;
    const vat = num(e.vatAmount) * sign;
    if (e.vatType === "VAT_12") {
      row.vatable12 += net;
      row.outputTax += vat;
    } else if (e.vatType === "ZERO_RATED") {
      row.zeroRated += net;
    } else if (e.vatType === "VAT_EXEMPT") {
      row.exempt += net;
    }
    row.totalInvoice += net + vat;
    // Classification of Sales: SERVICE → Service; goods / capital / untagged → Local.
    if (e.taxSource === "SERVICE") row.service += net;
    else row.local += net;
  }

  const rows = [...map.values()]
    .map((r) => ({
      ...r,
      exempt: round2(r.exempt),
      vatable12: round2(r.vatable12),
      zeroRated: round2(r.zeroRated),
      outputTax: round2(r.outputTax),
      totalInvoice: round2(r.totalInvoice),
      local: round2(r.local),
      service: round2(r.service),
    }))
    .sort((a, b) => a.postingDate.localeCompare(b.postingDate) || a.documentNo.localeCompare(b.documentNo));

  const totals = rows.reduce<SalesSubsidiaryTotals>(
    (t, r) => ({
      exempt: round2(t.exempt + r.exempt),
      vatable12: round2(t.vatable12 + r.vatable12),
      zeroRated: round2(t.zeroRated + r.zeroRated),
      outputTax: round2(t.outputTax + r.outputTax),
      totalInvoice: round2(t.totalInvoice + r.totalInvoice),
      local: round2(t.local + r.local),
      service: round2(t.service + r.service),
    }),
    { exempt: 0, vatable12: 0, zeroRated: 0, outputTax: 0, totalInvoice: 0, local: 0, service: 0 }
  );

  return { rows, totals };
}
