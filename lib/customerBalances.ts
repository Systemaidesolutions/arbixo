import { prisma } from "@/lib/prisma";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type CustomerBalanceSummaryRow = {
  customerId: string;
  code: string;
  name: string;
  balance: number;
};

export type CustomerBalanceDetailRow = {
  documentNo: string;
  postingDate: Date;
  transactionType: "Invoice" | "Credit Note";
  locationName: string | null;
  dueDate: Date | null;
  amount: number;
  openBalance: number;
  balance: number; // running total of openBalance, in date order
};

type OpenArItem = {
  documentNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  postingDate: Date;
  documentType: "INVOICE" | "CREDIT_MEMO";
  locationName: string | null;
  dueDate: Date | null;
  amount: number;
  openBalance: number;
};

/**
 * Every Sales on Account invoice and credit note (not cancelled) with a
 * non-zero open balance, across every customer — the shared source for both
 * the Customer Balance Summary and Detail reports. An invoice's open balance
 * is its amount minus whatever's been recorded via ReceivableApplication
 * (same tracking the "Apply to invoice(s)" feature on Cash Receipts writes
 * to). A credit note has no application tracking of its own — ARbixo has no
 * "apply credit note to invoice" workflow yet — so it always shows at its
 * full net amount.
 */
async function getOpenArItems(companyId: string, customerId?: string): Promise<OpenArItem[]> {
  const [lines, applied] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        customerId: customerId ?? { not: null },
        journalType: "SALES_ON_ACCOUNT",
        documentType: { in: ["INVOICE", "CREDIT_MEMO"] },
        isCancelled: false,
        account: { classification: "ACCOUNTS_RECEIVABLE" },
      },
      include: { customer: true, location: true },
      orderBy: [{ postingDate: "asc" }, { documentNo: "asc" }],
    }),
    prisma.receivableApplication.groupBy({
      by: ["invoiceDocumentNo"],
      where: { companyId, ...(customerId ? { customerId } : {}) },
      _sum: { amountApplied: true },
    }),
  ]);

  const appliedByDoc = new Map(applied.map((a) => [a.invoiceDocumentNo, Number(a._sum.amountApplied ?? 0)]));

  const byDoc = new Map<string, OpenArItem>();
  for (const e of lines) {
    if (!e.customerId) continue;
    let row = byDoc.get(e.documentNo);
    if (!row) {
      row = {
        documentNo: e.documentNo,
        customerId: e.customerId,
        customerCode: e.customer?.code ?? "",
        customerName: e.customer?.tradeName || e.customer?.registeredName || "",
        postingDate: e.postingDate,
        documentType: e.documentType as "INVOICE" | "CREDIT_MEMO",
        locationName: e.location?.name ?? null,
        dueDate: e.dueDate,
        amount: 0,
        openBalance: 0,
      };
      byDoc.set(e.documentNo, row);
    }
    row.amount += Number(e.debitAmount) - Number(e.creditAmount);
  }

  for (const row of byDoc.values()) {
    row.amount = round2(row.amount);
    const appliedAmt = row.documentType === "INVOICE" ? round2(appliedByDoc.get(row.documentNo) ?? 0) : 0;
    row.openBalance = round2(row.amount - appliedAmt);
  }

  return [...byDoc.values()].filter((r) => Math.abs(r.openBalance) > 0.005);
}

export async function getCustomerBalanceSummary(companyId: string): Promise<CustomerBalanceSummaryRow[]> {
  const items = await getOpenArItems(companyId);
  const byCustomer = new Map<string, CustomerBalanceSummaryRow>();
  for (const item of items) {
    let row = byCustomer.get(item.customerId);
    if (!row) {
      row = { customerId: item.customerId, code: item.customerCode, name: item.customerName, balance: 0 };
      byCustomer.set(item.customerId, row);
    }
    row.balance = round2(row.balance + item.openBalance);
  }
  return [...byCustomer.values()]
    .filter((r) => Math.abs(r.balance) > 0.005)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CustomerBalanceDetailGroup = {
  customerId: string;
  customerName: string;
  rows: CustomerBalanceDetailRow[];
  subtotal: number;
};

/**
 * Full company-wide detail report: every customer with an open balance,
 * each with their own open invoices/credit notes and a running subtotal —
 * the "print everything at once" counterpart to getCustomerBalanceDetail's
 * one-customer-at-a-time drill-down.
 */
export async function getCustomerBalanceDetailAll(
  companyId: string
): Promise<{ groups: CustomerBalanceDetailGroup[]; grandTotal: number }> {
  const items = await getOpenArItems(companyId);
  const byCustomer = new Map<string, { customerName: string; items: OpenArItem[] }>();
  for (const item of items) {
    let g = byCustomer.get(item.customerId);
    if (!g) {
      g = { customerName: item.customerName, items: [] };
      byCustomer.set(item.customerId, g);
    }
    g.items.push(item);
  }

  const groups: CustomerBalanceDetailGroup[] = [...byCustomer.entries()]
    .map(([customerId, g]) => {
      let running = 0;
      const rows = g.items.map((item) => {
        running = round2(running + item.openBalance);
        return {
          documentNo: item.documentNo,
          postingDate: item.postingDate,
          transactionType: item.documentType === "INVOICE" ? ("Invoice" as const) : ("Credit Note" as const),
          locationName: item.locationName,
          dueDate: item.dueDate,
          amount: item.amount,
          openBalance: item.openBalance,
          balance: running,
        };
      });
      return { customerId, customerName: g.customerName, rows, subtotal: running };
    })
    .filter((g) => Math.abs(g.subtotal) > 0.005)
    .sort((a, b) => a.customerName.localeCompare(b.customerName));

  const grandTotal = round2(groups.reduce((s, g) => s + g.subtotal, 0));
  return { groups, grandTotal };
}

export async function getCustomerBalanceDetail(
  companyId: string,
  customerId: string
): Promise<{ customerName: string; rows: CustomerBalanceDetailRow[]; totalBalance: number }> {
  const [items, customer] = await Promise.all([
    getOpenArItems(companyId, customerId),
    prisma.customer.findUnique({ where: { id: customerId }, select: { tradeName: true, registeredName: true } }),
  ]);
  let running = 0;
  const rows: CustomerBalanceDetailRow[] = items.map((item) => {
    running = round2(running + item.openBalance);
    return {
      documentNo: item.documentNo,
      postingDate: item.postingDate,
      transactionType: item.documentType === "INVOICE" ? "Invoice" : "Credit Note",
      locationName: item.locationName,
      dueDate: item.dueDate,
      amount: item.amount,
      openBalance: item.openBalance,
      balance: running,
    };
  });
  const customerName = customer?.tradeName || customer?.registeredName || "";
  return { customerName, rows, totalBalance: running };
}
