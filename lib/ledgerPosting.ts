import { prisma } from "@/lib/prisma";
import type { CounterpartyType, DocumentType, JournalType, VatType } from "@prisma/client";

export type LedgerLineInput = {
  accountId: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string | null;
  counterpartyType?: CounterpartyType | null;
  customerId?: string | null;
  vendorId?: string | null;
  employeeId?: string | null;
  contactId?: string | null;
  vatType?: VatType | null;
  grossAmount?: number | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  atcCode?: string | null;
  atcDescription?: string | null;
  withholdingAmt?: number | null;
  checkNo?: string | null;
};

export type PostDocumentInput = {
  companyId: string;
  locationId?: string | null;
  journalType: JournalType;
  documentType?: DocumentType | null;
  documentNo: string;
  postingDate: Date;
  isReturn?: boolean;
  lines: LedgerLineInput[];
};

export class UnbalancedEntryError extends Error {}
export class DuplicateDocumentError extends Error {}

// Compares to the nearest centavo rather than exact float equality —
// individual lines are already rounded via lib/vat.ts's round2(), but
// summing several of them can leave a sub-centavo float residue that
// exact equality would wrongly reject.
function isBalanced(totalDebit: number, totalCredit: number): boolean {
  return Math.round((totalDebit - totalCredit) * 100) === 0;
}

/**
 * Validates double-entry balance, checks the document number isn't
 * already used for this journal, then writes every line atomically —
 * either the whole document posts, or none of it does. This is the one
 * place that touches prisma.ledgerEntry.create, so every journal screen
 * gets the same integrity guarantees for free.
 */
export async function postDocument(input: PostDocumentInput) {
  const totalDebit = input.lines.reduce((sum, l) => sum + (l.debitAmount ?? 0), 0);
  const totalCredit = input.lines.reduce((sum, l) => sum + (l.creditAmount ?? 0), 0);

  if (!isBalanced(totalDebit, totalCredit)) {
    throw new UnbalancedEntryError(
      `Entry does not balance: total debit ${totalDebit.toFixed(2)} vs total credit ${totalCredit.toFixed(2)}`
    );
  }

  const existing = await prisma.ledgerEntry.findFirst({
    where: {
      companyId: input.companyId,
      journalType: input.journalType,
      documentNo: input.documentNo,
    },
  });
  if (existing) {
    throw new DuplicateDocumentError(
      `Document number "${input.documentNo}" is already used in this journal`
    );
  }

  return prisma.$transaction(
    input.lines.map((line, index) =>
      prisma.ledgerEntry.create({
        data: {
          companyId: input.companyId,
          locationId: input.locationId ?? null,
          journalType: input.journalType,
          documentType: input.documentType ?? null,
          documentNo: input.documentNo,
          lineNo: index + 1,
          postingDate: input.postingDate,
          isReturn: input.isReturn ?? false,
          accountId: line.accountId,
          debitAmount: line.debitAmount ?? 0,
          creditAmount: line.creditAmount ?? 0,
          description: line.description ?? null,
          counterpartyType: line.counterpartyType ?? null,
          customerId: line.customerId ?? null,
          vendorId: line.vendorId ?? null,
          employeeId: line.employeeId ?? null,
          contactId: line.contactId ?? null,
          vatType: line.vatType ?? null,
          grossAmount: line.grossAmount ?? null,
          netAmount: line.netAmount ?? null,
          vatAmount: line.vatAmount ?? null,
          atcCode: line.atcCode ?? null,
          atcDescription: line.atcDescription ?? null,
          withholdingAmt: line.withholdingAmt ?? null,
          checkNo: line.checkNo ?? null,
        },
      })
    )
  );
}

/** Best-effort suggestion only — the manual's own CV/OR/Invoice/PV/JV no.
 * fields are all "system-suggested but editable", so this doesn't need to
 * be authoritative, just a reasonable starting point. */
export async function suggestNextDocumentNo(
  companyId: string,
  journalType: JournalType
): Promise<string> {
  const latest = await prisma.ledgerEntry.findFirst({
    where: { companyId, journalType },
    orderBy: { entryNo: "desc" },
    select: { documentNo: true },
  });
  if (!latest) return "000001";

  const digitsOnly = latest.documentNo.replace(/\D/g, "");
  const numeric = parseInt(digitsOnly, 10);
  if (Number.isNaN(numeric)) return "000001";

  return String(numeric + 1).padStart(digitsOnly.length || 6, "0");
}
