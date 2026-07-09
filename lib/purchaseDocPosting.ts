import { prisma } from "@/lib/prisma";
import { postVatJournal } from "@/lib/vatJournals";
import { setAuditSuppressed } from "@/lib/auditContext";
import type { ExpandInputLine } from "@/lib/vatLineExpansion";

export class PurchaseDocError extends Error {}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Posts a DRAFT Purchase on Account to the ledger and updates inventory.
 *
 * Ledger (via the shared VAT-journal engine): each line debits its item's
 * Inventory ASSET account (INVENTORY items) or expense account (others), Input
 * VAT is debited, and Accounts Payable is credited for the total.
 *
 * Inventory: for each INVENTORY line, the item's quantityOnHand and moving
 * weighted-average cost are updated and a StockMovement is written. The doc is
 * marked POSTED.
 */
export async function postPurchaseDoc(companyId: string, docId: string, userId: string, isApproved: boolean): Promise<void> {
  const doc = await prisma.purchaseDoc.findFirst({
    where: { id: docId, companyId },
    include: { lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!doc) throw new PurchaseDocError("Purchase document not found.");
  if (doc.status === "POSTED") throw new PurchaseDocError("This document is already posted.");
  if (!doc.payableAccountId) throw new PurchaseDocError("Set the Accounts Payable account before posting.");
  if (doc.lines.length === 0) throw new PurchaseDocError("Add at least one line before posting.");

  const itemIds = [...new Set(doc.lines.map((l) => l.itemId).filter(Boolean))] as string[];
  const items = itemIds.length ? await prisma.item.findMany({ where: { id: { in: itemIds }, companyId } }) : [];
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Build the ledger input lines. Account per line: the item's inventory or
  // expense account, else the line's own account.
  const glLines: ExpandInputLine[] = [];
  for (const l of doc.lines) {
    const net = Number(l.amount);
    if (net <= 0) continue;
    const item = l.itemId ? itemById.get(l.itemId) : null;
    let accountId = l.accountId ?? null;
    if (item) accountId = item.type === "INVENTORY" ? item.inventoryAccountId : item.expenseAccountId;
    if (!accountId) throw new PurchaseDocError(`Line "${l.description}" has no posting account — set the item's account or choose one on the line.`);
    glLines.push({
      accountId,
      amount: net,
      vatType: l.vatType,
      amountIsGross: false,
      atcCodeId: null,
      taxSource: item && item.type === "SERVICE" ? "SERVICE" : "GOODS",
    });
  }
  if (glLines.length === 0) throw new PurchaseDocError("No valid lines to post.");

  // 1) Post to the ledger (throws DuplicateDocumentError / MissingPostingAccountError / ZeroBalanceError).
  await postVatJournal(
    companyId,
    "PURCHASE_ON_ACCOUNT",
    {
      documentNo: doc.transactionNo,
      postingDate: doc.transactionDate,
      locationId: doc.locationId,
      counterpartyType: "VENDOR",
      counterpartyId: doc.vendorId,
      balancingAccountId: doc.payableAccountId,
      particulars: doc.remarks,
      lines: glLines,
    },
    userId,
    isApproved
  );

  // 2) Update inventory (moving weighted average) + stock movements, mark posted.
  setAuditSuppressed(true);
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const l of doc.lines) {
          if (!l.itemId) continue;
          const item = itemById.get(l.itemId);
          if (!item || item.type !== "INVENTORY") continue;
          const qtyIn = Number(l.quantity);
          const unitCost = Number(l.unitCost);
          if (qtyIn <= 0) continue;

          const oldQty = Number(item.quantityOnHand);
          const oldAvg = Number(item.avgCost);
          const newQty = round4(oldQty + qtyIn);
          const newAvg = newQty > 0 ? round4((oldQty * oldAvg + qtyIn * unitCost) / newQty) : unitCost;

          await tx.item.update({
            where: { id: item.id },
            data: { quantityOnHand: newQty, avgCost: newAvg, defaultCost: unitCost },
          });
          // keep the in-memory copy current in case the same item appears on two lines
          item.quantityOnHand = newQty as unknown as typeof item.quantityOnHand;
          item.avgCost = newAvg as unknown as typeof item.avgCost;

          await tx.stockMovement.create({
            data: {
              companyId,
              itemId: item.id,
              type: "PURCHASE",
              movementDate: doc.transactionDate,
              quantity: qtyIn,
              unitCost,
              totalCost: round2(qtyIn * unitCost),
              balanceQty: newQty,
              balanceAvgCost: newAvg,
              sourceType: "PURCHASE_DOC",
              sourceId: doc.id,
            },
          });
        }
        await tx.purchaseDoc.update({
          where: { id: doc.id },
          data: { status: "POSTED", postedAt: new Date(), postedById: userId },
        });
      },
      { timeout: 60_000, maxWait: 15_000 }
    );
  } finally {
    setAuditSuppressed(false);
  }
}
