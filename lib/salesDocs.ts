import { prisma } from "@/lib/prisma";
import type { VatType } from "@prisma/client";

// Draft save + totals for the Sales Order document (mirror of purchaseDocs). A
// line's `amount` is the NET (VAT-exclusive) figure = qty × unitPrice less the
// line discount; VAT (12% for VAT_12, else 0) is added on top.

export type SalesLineInput = {
  itemId?: string | null;
  itemCode?: string | null;
  description?: string;
  quantity?: number | string;
  uom?: string | null;
  unitPrice?: number | string;
  discountPercent?: number | string;
  vatType?: VatType;
  accountId?: string | null;
};

export type SalesDocInput = {
  transactionNo?: string;
  transactionDate?: string;
  customerId?: string | null;
  customerTin?: string | null;
  locationId?: string | null;
  terms?: string | null;
  dueDate?: string | null;
  referenceNo?: string | null;
  currency?: string | null;
  remarks?: string | null;
  receivableAccountId?: string | null;
  vatInclusive?: boolean;
  otherCharges?: number | string;
  lines?: SalesLineInput[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function computeLine(l: SalesLineInput) {
  const gross = num(l.quantity) * num(l.unitPrice);
  const amount = round2(gross * (1 - num(l.discountPercent) / 100));
  const vatAmount = l.vatType === "VAT_12" ? round2(amount * 0.12) : 0;
  return { amount, vatAmount };
}

export function computeTotals(input: SalesDocInput) {
  let totalBeforeVat = 0;
  let totalVat = 0;
  for (const l of input.lines ?? []) {
    const { amount, vatAmount } = computeLine(l);
    totalBeforeVat += amount;
    totalVat += vatAmount;
  }
  const otherCharges = round2(num(input.otherCharges));
  totalBeforeVat = round2(totalBeforeVat);
  totalVat = round2(totalVat);
  return { totalBeforeVat, totalVat, otherCharges, totalAmount: round2(totalBeforeVat + totalVat + otherCharges) };
}

export async function suggestSalesNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const last = await prisma.salesDoc.findFirst({
    where: { companyId, transactionNo: { startsWith: prefix } },
    orderBy: { transactionNo: "desc" },
    select: { transactionNo: true },
  });
  const lastSeq = last ? Number(last.transactionNo.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(6, "0")}`;
}

export type SaveResult = { status: number; error?: string; id?: string };

export async function saveSalesDraft(companyId: string, userId: string, id: string | null, input: SalesDocInput): Promise<SaveResult> {
  const transactionNo = (input.transactionNo ?? "").trim();
  if (!transactionNo) return { status: 400, error: "Transaction no. is required." };
  if (!input.transactionDate) return { status: 400, error: "Transaction date is required." };

  const totals = computeTotals(input);
  const header = {
    transactionNo,
    transactionDate: new Date(`${input.transactionDate}T00:00:00`),
    customerId: input.customerId || null,
    customerTin: (input.customerTin ?? "").trim() || null,
    locationId: input.locationId || null,
    terms: (input.terms ?? "").trim() || null,
    dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00`) : null,
    referenceNo: (input.referenceNo ?? "").trim() || null,
    currency: (input.currency ?? "PHP").trim() || "PHP",
    remarks: (input.remarks ?? "").trim() || null,
    receivableAccountId: input.receivableAccountId || null,
    vatInclusive: input.vatInclusive ?? true,
    totalBeforeVat: totals.totalBeforeVat,
    discountAmount: 0,
    otherCharges: totals.otherCharges,
    totalVat: totals.totalVat,
    totalAmount: totals.totalAmount,
  };

  const lineData = (input.lines ?? [])
    .filter((l) => (l.description ?? "").trim() || l.itemId)
    .map((l, i) => {
      const { amount, vatAmount } = computeLine(l);
      return {
        lineNo: i + 1,
        itemId: l.itemId || null,
        itemCode: (l.itemCode ?? "").trim() || null,
        description: (l.description ?? "").trim() || "(no description)",
        quantity: num(l.quantity),
        uom: (l.uom ?? "").trim() || null,
        unitPrice: num(l.unitPrice),
        discountPercent: num(l.discountPercent),
        vatType: l.vatType ?? "VAT_12",
        amount,
        vatAmount,
        accountId: l.accountId || null,
      };
    });

  try {
    if (id) {
      const existing = await prisma.salesDoc.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
      if (!existing) return { status: 404, error: "Document not found." };
      if (existing.status === "POSTED") return { status: 409, error: "A posted document can't be edited." };
      await prisma.$transaction([
        prisma.salesDocLine.deleteMany({ where: { docId: id } }),
        prisma.salesDoc.update({ where: { id }, data: { ...header, lines: { create: lineData } } }),
      ]);
      return { status: 200, id };
    }
    const doc = await prisma.salesDoc.create({ data: { companyId, createdById: userId, status: "DRAFT", ...header, lines: { create: lineData } } });
    return { status: 200, id: doc.id };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { status: 409, error: `Transaction no. "${transactionNo}" already exists.` };
    throw e;
  }
}
