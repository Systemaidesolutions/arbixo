import { prisma } from "@/lib/prisma";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type VendorBalanceSummaryRow = {
  vendorId: string;
  code: string;
  name: string;
  balance: number;
};

export type VendorBalanceDetailRow = {
  documentNo: string;
  postingDate: Date;
  transactionType: "Bill" | "Credit Note";
  locationName: string | null;
  dueDate: Date | null;
  amount: number;
  openBalance: number;
  balance: number; // running total of openBalance, in date order
};

type OpenApItem = {
  documentNo: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  postingDate: Date;
  documentType: "PURCHASE" | "CREDIT_MEMO";
  locationName: string | null;
  dueDate: Date | null;
  amount: number;
  openBalance: number;
};

export type DateRange = { from?: Date; to?: Date };

/**
 * AP mirror of getOpenArItems (lib/customerBalances.ts) — every Purchase on
 * Account bill and credit note (not cancelled) with a non-zero open
 * balance, across every vendor. A bill's open balance is its amount minus
 * whatever's been recorded via PayableApplication (same tracking the
 * "Apply to bill(s)" feature on Cash Disbursement writes to). A credit note
 * has no application tracking of its own, so it always shows at its full
 * net amount.
 *
 * `range` narrows to bills/credit notes posted within [from, to]
 * (inclusive) — it filters which documents appear, not the applied
 * amounts, so a shown document's open balance is still its current balance.
 */
async function getOpenApItems(companyId: string, vendorId?: string, range?: DateRange): Promise<OpenApItem[]> {
  const [lines, applied] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        vendorId: vendorId ?? { not: null },
        journalType: "PURCHASE_ON_ACCOUNT",
        documentType: { in: ["PURCHASE", "CREDIT_MEMO"] },
        isCancelled: false,
        account: { classification: "ACCOUNTS_PAYABLE" },
        ...(range?.from || range?.to
          ? { postingDate: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      include: { vendor: true, location: true },
      orderBy: [{ postingDate: "asc" }, { documentNo: "asc" }],
    }),
    prisma.payableApplication.groupBy({
      by: ["invoiceDocumentNo"],
      where: { companyId, ...(vendorId ? { vendorId } : {}) },
      _sum: { amountApplied: true },
    }),
  ]);

  const appliedByDoc = new Map(applied.map((a) => [a.invoiceDocumentNo, Number(a._sum.amountApplied ?? 0)]));

  const byDoc = new Map<string, OpenApItem>();
  for (const e of lines) {
    if (!e.vendorId) continue;
    let row = byDoc.get(e.documentNo);
    if (!row) {
      row = {
        documentNo: e.documentNo,
        vendorId: e.vendorId,
        vendorCode: e.vendor?.code ?? "",
        vendorName: e.vendor?.tradeName || e.vendor?.registeredName || "",
        postingDate: e.postingDate,
        documentType: e.documentType as "PURCHASE" | "CREDIT_MEMO",
        locationName: e.location?.name ?? null,
        dueDate: e.dueDate,
        amount: 0,
        openBalance: 0,
      };
      byDoc.set(e.documentNo, row);
    }
    row.amount += Number(e.creditAmount) - Number(e.debitAmount);
  }

  for (const row of byDoc.values()) {
    row.amount = round2(row.amount);
    const appliedAmt = row.documentType === "PURCHASE" ? round2(appliedByDoc.get(row.documentNo) ?? 0) : 0;
    row.openBalance = round2(row.amount - appliedAmt);
  }

  return [...byDoc.values()].filter((r) => Math.abs(r.openBalance) > 0.005);
}

export async function getVendorBalanceSummary(companyId: string, range?: DateRange): Promise<VendorBalanceSummaryRow[]> {
  const items = await getOpenApItems(companyId, undefined, range);
  const byVendor = new Map<string, VendorBalanceSummaryRow>();
  for (const item of items) {
    let row = byVendor.get(item.vendorId);
    if (!row) {
      row = { vendorId: item.vendorId, code: item.vendorCode, name: item.vendorName, balance: 0 };
      byVendor.set(item.vendorId, row);
    }
    row.balance = round2(row.balance + item.openBalance);
  }
  return [...byVendor.values()]
    .filter((r) => Math.abs(r.balance) > 0.005)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type VendorBalanceDetailGroup = {
  vendorId: string;
  vendorName: string;
  rows: VendorBalanceDetailRow[];
  subtotal: number;
};

/**
 * Full company-wide detail report: every vendor with an open balance, each
 * with their own open bills/credit notes and a running subtotal — the
 * "print everything at once" counterpart to getVendorBalanceDetail's
 * one-vendor-at-a-time drill-down.
 */
export async function getVendorBalanceDetailAll(
  companyId: string,
  range?: DateRange
): Promise<{ groups: VendorBalanceDetailGroup[]; grandTotal: number }> {
  const items = await getOpenApItems(companyId, undefined, range);
  const byVendor = new Map<string, { vendorName: string; items: OpenApItem[] }>();
  for (const item of items) {
    let g = byVendor.get(item.vendorId);
    if (!g) {
      g = { vendorName: item.vendorName, items: [] };
      byVendor.set(item.vendorId, g);
    }
    g.items.push(item);
  }

  const groups: VendorBalanceDetailGroup[] = [...byVendor.entries()]
    .map(([vendorId, g]) => {
      let running = 0;
      const rows = g.items.map((item) => {
        running = round2(running + item.openBalance);
        return {
          documentNo: item.documentNo,
          postingDate: item.postingDate,
          transactionType: item.documentType === "PURCHASE" ? ("Bill" as const) : ("Credit Note" as const),
          locationName: item.locationName,
          dueDate: item.dueDate,
          amount: item.amount,
          openBalance: item.openBalance,
          balance: running,
        };
      });
      return { vendorId, vendorName: g.vendorName, rows, subtotal: running };
    })
    .filter((g) => Math.abs(g.subtotal) > 0.005)
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName));

  const grandTotal = round2(groups.reduce((s, g) => s + g.subtotal, 0));
  return { groups, grandTotal };
}

export async function getVendorBalanceDetail(
  companyId: string,
  vendorId: string,
  range?: DateRange
): Promise<{ vendorName: string; rows: VendorBalanceDetailRow[]; totalBalance: number }> {
  const [items, vendor] = await Promise.all([
    getOpenApItems(companyId, vendorId, range),
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { tradeName: true, registeredName: true } }),
  ]);
  let running = 0;
  const rows: VendorBalanceDetailRow[] = items.map((item) => {
    running = round2(running + item.openBalance);
    return {
      documentNo: item.documentNo,
      postingDate: item.postingDate,
      transactionType: item.documentType === "PURCHASE" ? "Bill" : "Credit Note",
      locationName: item.locationName,
      dueDate: item.dueDate,
      amount: item.amount,
      openBalance: item.openBalance,
      balance: running,
    };
  });
  const vendorName = vendor?.tradeName || vendor?.registeredName || "";
  return { vendorName, rows, totalBalance: running };
}
