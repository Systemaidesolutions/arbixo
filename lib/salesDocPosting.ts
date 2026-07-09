import { prisma } from "@/lib/prisma";
import { setAuditSuppressed } from "@/lib/auditContext";
import { postDocument, type LedgerLineInput } from "@/lib/ledgerPosting";
import { expandVatLines, counterpartyFields, type ExpandInputLine } from "@/lib/vatLineExpansion";

export class SalesDocError extends Error {}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Posts a DRAFT Sales Order to the ledger and relieves inventory.
 *
 * Ledger (one entry): revenue side via the shared VAT engine — each line credits
 * its item's income account, Output VAT is credited, and Accounts Receivable is
 * debited for the total. For INVENTORY lines a cost-of-sales side is added:
 * Dr COGS / Cr Inventory at the item's current moving-average cost.
 *
 * Inventory: each INVENTORY line reduces quantityOnHand (avg cost unchanged on a
 * sale) and writes a negative StockMovement. The doc is marked POSTED.
 */
export async function postSalesDoc(companyId: string, docId: string, userId: string, isApproved: boolean): Promise<void> {
  const doc = await prisma.salesDoc.findFirst({ where: { id: docId, companyId }, include: { lines: { orderBy: { lineNo: "asc" } } } });
  if (!doc) throw new SalesDocError("Sales document not found.");
  if (doc.status === "POSTED") throw new SalesDocError("This document is already posted.");
  if (!doc.receivableAccountId) throw new SalesDocError("Set the Accounts Receivable account before posting.");
  if (doc.lines.length === 0) throw new SalesDocError("Add at least one line before posting.");

  const itemIds = [...new Set(doc.lines.map((l) => l.itemId).filter(Boolean))] as string[];
  const items = itemIds.length ? await prisma.item.findMany({ where: { id: { in: itemIds }, companyId } }) : [];
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Revenue input lines (credit side).
  const revenueLines: ExpandInputLine[] = [];
  for (const l of doc.lines) {
    const net = Number(l.amount);
    if (net <= 0) continue;
    const item = l.itemId ? itemById.get(l.itemId) : null;
    let accountId = l.accountId ?? null;
    if (item) accountId = item.incomeAccountId;
    if (!accountId) throw new SalesDocError(`Line "${l.description}" has no income account — set the item's income account or choose one on the line.`);
    revenueLines.push({ accountId, amount: net, vatType: l.vatType, amountIsGross: false, atcCodeId: null, taxSource: item && item.type === "SERVICE" ? "SERVICE" : "GOODS" });
  }
  if (revenueLines.length === 0) throw new SalesDocError("No valid lines to post.");

  const counterparty = counterpartyFields(doc.customerId ? "CUSTOMER" : null, doc.customerId);
  const { glLines, balancingAmount } = await expandVatLines(companyId, revenueLines, "CREDIT", counterparty, doc.remarks ?? null, doc.transactionNo);
  if (balancingAmount <= 0) throw new SalesDocError("Computed receivable amount is zero or negative — check the line amounts.");

  // A/R debit (the money owed by the customer).
  glLines.push({ accountId: doc.receivableAccountId, debitAmount: balancingAmount, description: doc.remarks ?? null, ...counterparty });

  // Cost of sales for inventory lines, at each item's moving-average cost.
  type InvEffect = { itemId: string; qtyOut: number; cost: number };
  const invEffects: InvEffect[] = [];
  const cogsByAcct = new Map<string, number>();
  const invByAcct = new Map<string, number>();
  for (const l of doc.lines) {
    if (!l.itemId) continue;
    const item = itemById.get(l.itemId);
    if (!item || item.type !== "INVENTORY") continue;
    const qtyOut = Number(l.quantity);
    if (qtyOut <= 0) continue;
    const cost = round2(qtyOut * Number(item.avgCost));
    invEffects.push({ itemId: item.id, qtyOut, cost });
    if (cost > 0) {
      if (!item.expenseAccountId || !item.inventoryAccountId) {
        throw new SalesDocError(`Inventory item "${item.code}" needs both a COGS and an Inventory account to be sold.`);
      }
      cogsByAcct.set(item.expenseAccountId, round2((cogsByAcct.get(item.expenseAccountId) ?? 0) + cost));
      invByAcct.set(item.inventoryAccountId, round2((invByAcct.get(item.inventoryAccountId) ?? 0) + cost));
    }
  }
  for (const [accountId, amt] of cogsByAcct) glLines.push({ accountId, debitAmount: amt, description: `COGS — ${doc.transactionNo}`, ...counterparty });
  for (const [accountId, amt] of invByAcct) glLines.push({ accountId, creditAmount: amt, description: `Inventory relief — ${doc.transactionNo}`, ...counterparty } as LedgerLineInput);

  // 1) Post the balanced entry (Dr A/R + Dr COGS = Cr Sales + Cr Output VAT + Cr Inventory).
  await postDocument({
    companyId,
    locationId: doc.locationId,
    journalType: "SALES_ON_ACCOUNT",
    documentType: "INVOICE",
    documentNo: doc.transactionNo,
    postingDate: doc.transactionDate,
    isReturn: false,
    lines: glLines,
    createdById: userId,
    isApproved,
  });

  // 2) Relieve inventory + stock movements, mark posted.
  setAuditSuppressed(true);
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const eff of invEffects) {
          const item = itemById.get(eff.itemId)!;
          const avg = Number(item.avgCost);
          const newQty = round4(Number(item.quantityOnHand) - eff.qtyOut);
          await tx.item.update({ where: { id: item.id }, data: { quantityOnHand: newQty } });
          item.quantityOnHand = newQty as unknown as typeof item.quantityOnHand;
          await tx.stockMovement.create({
            data: {
              companyId, itemId: item.id, type: "SALE", movementDate: doc.transactionDate,
              quantity: -eff.qtyOut, unitCost: avg, totalCost: -eff.cost,
              balanceQty: newQty, balanceAvgCost: avg, sourceType: "SALES_DOC", sourceId: doc.id,
            },
          });
        }
        await tx.salesDoc.update({ where: { id: doc.id }, data: { status: "POSTED", postedAt: new Date(), postedById: userId } });
      },
      { timeout: 60_000, maxWait: 15_000 }
    );
  } finally {
    setAuditSuppressed(false);
  }
}
