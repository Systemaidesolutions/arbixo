import { prisma } from "@/lib/prisma";
import { partyName } from "@/lib/slsp";

// VAT Purchase Subsidiary Journal — one row per purchase invoice (purchases on
// account and cash purchases that carry a VAT classification), with the BIR
// breakdown: VAT purchases (12%), non-VAT purchases (exempt / zero-rated),
// input VAT, total invoice, the account(s) debited, the invoice's GL debit /
// credit totals, and the cash/account term.

function num(d: unknown): number {
  return Number(d ?? 0);
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// A purchase debits an expense or asset account. This lets us tell a real
// purchase line from the input-VAT companion (no vatType) and from non-purchase
// disbursements such as loan/AP payments (which debit liabilities).
const PURCHASE_CLASSES: string[] = [
  "EXPENSE", "INVENTORY", "FIXED_ASSET", "OTHER_CURRENT_ASSET", "OTHER_ASSET",
];

type PartyLike = {
  tin: string | null;
  address?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  zipCode?: string | null;
} & Parameters<typeof partyName>[0];

function partyAddress(p: PartyLike): string {
  return [p.address, p.barangay, p.city, p.province, p.zipCode].filter(Boolean).join(", ");
}

export type PurchaseSubsidiaryRow = {
  key: string;
  postingDate: string;
  documentNo: string; // internal PV / document number (grouping key)
  invoiceNo: string; // supplier invoice = the line reference no.
  supplierName: string;
  supplierAddress: string;
  vatRegNo: string; // supplier TIN
  vatPurchLocal: number; // VAT Purchases (Goods) — Local (12% net)
  nonVatLocal: number; // Non-VAT Purchases (Goods) — Local (exempt net)
  nonVatZero: number; // Non-VAT Purchases (Goods) — Zero Rated (net)
  inputVat: number; // Input VAT
  totalInvoice: number; // Total Invoice Amount (gross)
  accountName: string; // Name of Account(s) debited
  glDebit: number; // General Ledger — Debit total for the invoice
  glCredit: number; // General Ledger — Credit total for the invoice
  terms: "Cash" | "Account";
};

export type PurchaseSubsidiaryTotals = {
  vatPurchLocal: number;
  nonVatLocal: number;
  nonVatZero: number;
  inputVat: number;
  totalInvoice: number;
  glDebit: number;
  glCredit: number;
};

export type PurchaseSubsidiaryJournal = {
  rows: PurchaseSubsidiaryRow[];
  totals: PurchaseSubsidiaryTotals;
};

export async function getPurchaseSubsidiaryJournal(
  companyId: string,
  from: Date,
  to: Date
): Promise<PurchaseSubsidiaryJournal> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      postingDate: { gte: from, lte: to },
      journalType: { in: ["PURCHASE_ON_ACCOUNT", "CASH_DISBURSEMENT"] },
    },
    include: { account: true, vendor: true, contact: true, employee: true },
    orderBy: [{ postingDate: "asc" }, { documentNo: "asc" }, { lineNo: "asc" }],
  });

  // Group every line by document so we can compute the invoice's GL totals,
  // then keep only documents that are actual purchases (have a VAT-classified
  // debit line).
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = `${e.journalType}|${e.documentNo}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  const rows: PurchaseSubsidiaryRow[] = [];
  for (const [key, lines] of groups) {
    // Real purchase lines: a debit to an expense/asset account carrying any
    // vatType (VAT_12, NON_VAT, VAT_EXEMPT, ZERO_RATED). NON_VAT purchases are
    // included; the input-VAT companion (no vatType) and non-purchase debits
    // (liabilities, cash) are excluded.
    const purchaseLines = lines.filter(
      (l) => num(l.debitAmount) > 0 && l.vatType != null && PURCHASE_CLASSES.includes(l.account.classification)
    );
    if (purchaseLines.length === 0) continue; // not a purchase invoice

    const first = lines[0];
    const partySrc = (lines.find((l) => l.vendor)?.vendor ??
      lines.find((l) => l.contact)?.contact ??
      lines.find((l) => l.employee)?.employee ??
      null) as PartyLike | null;

    let vatPurchLocal = 0;
    let nonVatLocal = 0;
    let nonVatZero = 0;
    let inputVat = 0;
    let totalInvoice = 0;
    const accountTitles = new Set<string>();
    const refs = new Set<string>();
    for (const l of purchaseLines) {
      const sign = l.isReturn ? -1 : 1;
      const net = (num(l.netAmount) || num(l.debitAmount)) * sign;
      const vat = num(l.vatAmount) * sign;
      if (l.vatType === "VAT_12") {
        vatPurchLocal += net;
        inputVat += vat;
      } else if (l.vatType === "ZERO_RATED") {
        nonVatZero += net;
      } else {
        // NON_VAT and VAT_EXEMPT → Non-VAT Purchases (Goods), Local
        nonVatLocal += net;
      }
      totalInvoice += net + vat;
      accountTitles.add(l.account.title);
      if (l.referenceNo) refs.add(l.referenceNo);
    }
    // Fall back to any line's reference if the main lines had none.
    if (refs.size === 0) for (const l of lines) if (l.referenceNo) refs.add(l.referenceNo);

    let glDebit = 0;
    let glCredit = 0;
    for (const l of lines) {
      const sign = l.isReturn ? -1 : 1;
      glDebit += num(l.debitAmount) * sign;
      glCredit += num(l.creditAmount) * sign;
    }

    rows.push({
      key,
      postingDate: first.postingDate.toISOString(),
      documentNo: first.documentNo,
      invoiceNo: [...refs].join(", ") || first.documentNo,
      supplierName: partySrc ? partyName(partySrc) : "",
      supplierAddress: partySrc ? partyAddress(partySrc) : "",
      vatRegNo: partySrc?.tin ?? "",
      vatPurchLocal: round2(vatPurchLocal),
      nonVatLocal: round2(nonVatLocal),
      nonVatZero: round2(nonVatZero),
      inputVat: round2(inputVat),
      totalInvoice: round2(totalInvoice),
      accountName: [...accountTitles].join(", "),
      glDebit: round2(glDebit),
      glCredit: round2(glCredit),
      terms: first.journalType === "CASH_DISBURSEMENT" ? "Cash" : "Account",
    });
  }

  rows.sort((a, b) => a.postingDate.localeCompare(b.postingDate) || a.documentNo.localeCompare(b.documentNo));

  const totals = rows.reduce<PurchaseSubsidiaryTotals>(
    (t, r) => ({
      vatPurchLocal: round2(t.vatPurchLocal + r.vatPurchLocal),
      nonVatLocal: round2(t.nonVatLocal + r.nonVatLocal),
      nonVatZero: round2(t.nonVatZero + r.nonVatZero),
      inputVat: round2(t.inputVat + r.inputVat),
      totalInvoice: round2(t.totalInvoice + r.totalInvoice),
      glDebit: round2(t.glDebit + r.glDebit),
      glCredit: round2(t.glCredit + r.glCredit),
    }),
    { vatPurchLocal: 0, nonVatLocal: 0, nonVatZero: 0, inputVat: 0, totalInvoice: 0, glDebit: 0, glCredit: 0 }
  );

  return { rows, totals };
}
