import { postDocument, type LedgerLineInput } from "@/lib/ledgerPosting";
import { expandVatLines, counterpartyFields, flipLines, type ExpandInputLine } from "@/lib/vatLineExpansion";
import type { CounterpartyType, DocumentType, JournalType } from "@prisma/client";

export class ZeroBalanceError extends Error {}

// The four VAT-aware journals share one posting shape: expand the VAT/withholding
// lines, then add a single balancing line (cash / receivable / payable). They
// differ only in direction, journal/document type, which side the balancing line
// sits on, the balancing account, the default counterparty, and whether returns
// (credit memos) apply.
export type VatJournalKey = "CASH_DISBURSEMENT" | "CASH_RECEIPT" | "SALES_ON_ACCOUNT" | "PURCHASE_ON_ACCOUNT";

export type VatJournalConfig = {
  key: VatJournalKey;
  path: string; // route segment, e.g. "cash-disbursement"
  title: string;
  refLabel: string; // document-no label, e.g. "CV No"
  journalType: JournalType;
  documentType: DocumentType;
  returnDocumentType?: DocumentType;
  direction: "DEBIT" | "CREDIT"; // side the expanded expense/income lines take
  balancingSide: "debit" | "credit"; // side the balancing line takes
  balancingHeader: string; // template column, e.g. "Cash Account Code"
  balancingLabel: string; // display, e.g. "Cash account"
  defaultParty: CounterpartyType | null;
  hasCheck: boolean;
  hasReturn: boolean;
  zeroMessage: string;
};

export const VAT_JOURNALS: Record<VatJournalKey, VatJournalConfig> = {
  CASH_DISBURSEMENT: {
    key: "CASH_DISBURSEMENT", path: "cash-disbursement", title: "Cash Disbursement", refLabel: "CV No",
    journalType: "CASH_DISBURSEMENT", documentType: "PAYMENT", direction: "DEBIT", balancingSide: "credit",
    balancingHeader: "Cash Account Code", balancingLabel: "Cash account", defaultParty: null,
    hasCheck: true, hasReturn: false, zeroMessage: "Computed cash amount is zero or negative — check the line amounts.",
  },
  CASH_RECEIPT: {
    key: "CASH_RECEIPT", path: "cash-receipts", title: "Cash Receipt", refLabel: "OR No",
    journalType: "CASH_RECEIPT", documentType: "RECEIPT", direction: "CREDIT", balancingSide: "debit",
    balancingHeader: "Cash Account Code", balancingLabel: "Cash account", defaultParty: null,
    hasCheck: false, hasReturn: false, zeroMessage: "Computed cash amount is zero or negative — check the line amounts.",
  },
  SALES_ON_ACCOUNT: {
    key: "SALES_ON_ACCOUNT", path: "sales", title: "Sales", refLabel: "Invoice No",
    journalType: "SALES_ON_ACCOUNT", documentType: "INVOICE", returnDocumentType: "CREDIT_MEMO",
    direction: "CREDIT", balancingSide: "debit", balancingHeader: "Receivable Account Code",
    balancingLabel: "Receivable account", defaultParty: "CUSTOMER", hasCheck: false, hasReturn: true,
    zeroMessage: "Computed receivable amount is zero or negative — check the line amounts.",
  },
  PURCHASE_ON_ACCOUNT: {
    key: "PURCHASE_ON_ACCOUNT", path: "purchases", title: "Purchase", refLabel: "PV No",
    journalType: "PURCHASE_ON_ACCOUNT", documentType: "PURCHASE", returnDocumentType: "CREDIT_MEMO",
    direction: "DEBIT", balancingSide: "credit", balancingHeader: "Payable Account Code",
    balancingLabel: "Payable account", defaultParty: "VENDOR", hasCheck: false, hasReturn: true,
    zeroMessage: "Computed payable amount is zero or negative — check the line amounts.",
  },
};

export type VatJournalDoc = {
  locationId?: string | null;
  documentNo: string;
  checkNo?: string | null;
  postingDate: Date;
  counterpartyType?: CounterpartyType | null;
  counterpartyId?: string | null;
  balancingAccountId: string;
  particulars?: string | null;
  paymentTerms?: string | null;
  dueDate?: string | null;
  isReturn?: boolean;
  lines: ExpandInputLine[];
};

/** Posts one VAT-journal document (cash disbursement / receipt / sales / purchase). */
export async function postVatJournal(
  companyId: string,
  key: VatJournalKey,
  doc: VatJournalDoc,
  createdById: string,
  isApproved: boolean
) {
  const cfg = VAT_JOURNALS[key];
  const counterparty = counterpartyFields(doc.counterpartyType ?? cfg.defaultParty, doc.counterpartyId ?? null);

  // Fold the distinct line reference nos into the particulars, so the posted
  // description carries them (the balancing line also keeps them in referenceNo).
  const docRef = [...new Set(doc.lines.map((l) => (l.referenceNo ?? "").trim()).filter(Boolean))].join(", ") || null;
  const particulars = docRef
    ? [doc.particulars?.trim(), `Ref: ${docRef}`].filter(Boolean).join(" — ")
    : doc.particulars ?? null;

  const { glLines, balancingAmount } = await expandVatLines(
    companyId, doc.lines, cfg.direction, counterparty, particulars, doc.documentNo
  );
  if (balancingAmount <= 0) throw new ZeroBalanceError(cfg.zeroMessage);

  const balLine: LedgerLineInput = {
    accountId: doc.balancingAccountId,
    description: particulars,
    referenceNo: docRef,
    paymentTerms: doc.paymentTerms ?? null,
    dueDate: doc.dueDate ?? null,
    ...counterparty,
    ...(cfg.balancingSide === "credit" ? { creditAmount: balancingAmount } : { debitAmount: balancingAmount }),
    ...(cfg.hasCheck ? { checkNo: doc.checkNo ?? null } : {}),
  };
  glLines.push(balLine);

  const isReturn = cfg.hasReturn && Boolean(doc.isReturn);
  const finalLines = isReturn ? flipLines(glLines) : glLines;

  return postDocument({
    companyId,
    locationId: doc.locationId ?? null,
    journalType: cfg.journalType,
    documentType: isReturn && cfg.returnDocumentType ? cfg.returnDocumentType : cfg.documentType,
    documentNo: doc.documentNo,
    postingDate: doc.postingDate,
    isReturn,
    lines: finalLines,
    createdById,
    isApproved,
  });
}
