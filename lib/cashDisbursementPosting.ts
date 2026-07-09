import { postDocument } from "@/lib/ledgerPosting";
import { expandVatLines, counterpartyFields, type ExpandInputLine } from "@/lib/vatLineExpansion";
import type { CounterpartyType } from "@prisma/client";

export class ZeroCashError extends Error {}

export type CashDisbursementDoc = {
  locationId?: string | null;
  documentNo: string;
  checkNo?: string | null;
  postingDate: Date;
  counterpartyType?: CounterpartyType | null;
  counterpartyId?: string | null;
  cashAccountId: string;
  particulars?: string | null;
  lines: ExpandInputLine[];
};

/**
 * Posts one Cash Disbursement voucher: expands the expense lines (VAT +
 * withholding), computes the balancing cash credit, and writes the document.
 * Shared by the encoding API and the Excel/CSV importer so both behave
 * identically. Throws MissingPostingAccountError / ZeroCashError /
 * UnbalancedEntryError / DuplicateDocumentError for the caller to surface.
 */
export async function postCashDisbursement(
  companyId: string,
  doc: CashDisbursementDoc,
  createdById: string,
  isApproved: boolean
) {
  const counterparty = counterpartyFields(doc.counterpartyType ?? null, doc.counterpartyId ?? null);
  const { glLines, balancingAmount } = await expandVatLines(
    companyId,
    doc.lines,
    "DEBIT",
    counterparty,
    doc.particulars ?? null,
    doc.documentNo
  );
  const cashAmount = balancingAmount; // total debit minus withholding credited

  if (cashAmount <= 0) {
    throw new ZeroCashError("Computed cash amount is zero or negative — check the line amounts.");
  }

  glLines.push({
    accountId: doc.cashAccountId,
    creditAmount: cashAmount,
    description: doc.particulars ?? null,
    checkNo: doc.checkNo ?? null,
    ...counterparty,
  });

  return postDocument({
    companyId,
    locationId: doc.locationId ?? null,
    journalType: "CASH_DISBURSEMENT",
    documentType: "PAYMENT",
    documentNo: doc.documentNo,
    postingDate: doc.postingDate,
    lines: glLines,
    createdById,
    isApproved,
  });
}
