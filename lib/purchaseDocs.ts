import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import type { VatType } from "@prisma/client";

// Draft save + total computation for the Purchase on Account document. Amounts:
// a line's `amount` is the NET (VAT-exclusive) figure = qty × unitCost less the
// line discount; VAT is added on top (12% for VAT_12, else 0). This matches the
// mockup where the Amount column is net and VAT is a separate column.

export type PurchaseLineInput = {
  itemId?: string | null;
  itemCode?: string | null;
  description?: string;
  quantity?: number | string;
  uom?: string | null;
  unitCost?: number | string;
  discountPercent?: number | string;
  vatType?: VatType;
  accountId?: string | null;
};

export type PurchaseDocInput = {
  transactionNo?: string;
  transactionDate?: string;
  vendorId?: string | null;
  supplierTin?: string | null;
  locationId?: string | null;
  terms?: string | null;
  dueDate?: string | null;
  referenceNo?: string | null;
  purchaseOrderNo?: string | null;
  currency?: string | null;
  remarks?: string | null;
  payableAccountId?: string | null;
  vatInclusive?: boolean;
  otherCharges?: number | string;
  lines?: PurchaseLineInput[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function computeLine(l: PurchaseLineInput) {
  const qty = num(l.quantity);
  const cost = num(l.unitCost);
  const disc = num(l.discountPercent);
  const gross = qty * cost;
  const amount = round2(gross * (1 - disc / 100)); // net, before VAT
  const vatAmount = l.vatType === "VAT_12" ? round2(amount * 0.12) : 0;
  return { amount, vatAmount };
}

export function computeTotals(input: PurchaseDocInput) {
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
  const totalAmount = round2(totalBeforeVat + totalVat + otherCharges);
  return { totalBeforeVat, totalVat, otherCharges, totalAmount };
}

/** Poster's company id (anyone who can post transactions). */
export async function poster() {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) return null;
  const cap = capabilitiesFor(user.role, user.subscriberSubtype);
  if (!cap.canPost) return null;
  return { companyId: user.companyId, userId: user.id, email: user.email, canApprove: cap.canApprove };
}

export async function suggestTransactionNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `POA-${year}-`;
  const last = await prisma.purchaseDoc.findFirst({
    where: { companyId, transactionNo: { startsWith: prefix } },
    orderBy: { transactionNo: "desc" },
    select: { transactionNo: true },
  });
  const lastSeq = last ? Number(last.transactionNo.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(6, "0")}`;
}

export type SaveResult = { status: number; error?: string; id?: string };

/**
 * Creates or updates a DRAFT purchase document (header + lines). Lines are
 * replaced wholesale. Returns the doc id. Does NOT post to the ledger.
 */
export async function saveDraft(companyId: string, userId: string, id: string | null, input: PurchaseDocInput): Promise<SaveResult> {
  const transactionNo = (input.transactionNo ?? "").trim();
  if (!transactionNo) return { status: 400, error: "Transaction no. is required." };
  if (!input.transactionDate) return { status: 400, error: "Transaction date is required." };

  const totals = computeTotals(input);
  const header = {
    transactionNo,
    transactionDate: new Date(`${input.transactionDate}T00:00:00`),
    vendorId: input.vendorId || null,
    supplierTin: (input.supplierTin ?? "").trim() || null,
    locationId: input.locationId || null,
    terms: (input.terms ?? "").trim() || null,
    dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00`) : null,
    referenceNo: (input.referenceNo ?? "").trim() || null,
    purchaseOrderNo: (input.purchaseOrderNo ?? "").trim() || null,
    currency: (input.currency ?? "PHP").trim() || "PHP",
    remarks: (input.remarks ?? "").trim() || null,
    payableAccountId: input.payableAccountId || null,
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
        unitCost: num(l.unitCost),
        discountPercent: num(l.discountPercent),
        vatType: l.vatType ?? "VAT_12",
        amount,
        vatAmount,
        accountId: l.accountId || null,
      };
    });

  try {
    if (id) {
      const existing = await prisma.purchaseDoc.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
      if (!existing) return { status: 404, error: "Document not found." };
      if (existing.status === "POSTED") return { status: 409, error: "A posted document can't be edited." };
      await prisma.$transaction([
        prisma.purchaseDocLine.deleteMany({ where: { docId: id } }),
        prisma.purchaseDoc.update({ where: { id }, data: { ...header, lines: { create: lineData } } }),
      ]);
      return { status: 200, id };
    }
    const doc = await prisma.purchaseDoc.create({
      data: { companyId, createdById: userId, status: "DRAFT", ...header, lines: { create: lineData } },
    });
    return { status: 200, id: doc.id };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { status: 409, error: `Transaction no. "${transactionNo}" already exists.` };
    throw e;
  }
}
