import { prisma } from "@/lib/prisma";
import type { JournalType } from "@prisma/client";
import type { DocumentSummary } from "@/app/api/ledger-entries/route";

// Shared lookup behind the transaction-summary popup and its Excel export.
// A blank term returns every document for the journal (newest first); a term
// matches document no., description, reference no., check no., or the
// counterparty's name. Returns one summary row per document.
export async function searchLedgerDocuments(
  companyId: string,
  journalType: JournalType,
  q?: string | null,
  limit = 200
): Promise<DocumentSummary[]> {
  const term = (q ?? "").trim();
  const contains = { contains: term, mode: "insensitive" as const };

  const where = term
    ? {
        companyId,
        journalType,
        OR: [
          { documentNo: contains },
          { description: contains },
          { referenceNo: contains },
          { checkNo: contains },
          { customer: { is: { tradeName: contains } } },
          { vendor: { is: { tradeName: contains } } },
          { contact: { is: { tradeName: contains } } },
          { employee: { is: { OR: [{ firstName: contains }, { lastName: contains }] } } },
        ],
      }
    : { companyId, journalType };

  const hits = await prisma.ledgerEntry.findMany({
    where,
    select: { documentNo: true },
    orderBy: { postingDate: "desc" },
    take: limit * 6, // several lines per document; de-duped below
  });

  const docNos = [...new Set(hits.map((h) => h.documentNo))].slice(0, limit);
  if (docNos.length === 0) return [];

  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId, journalType, documentNo: { in: docNos } },
    include: { customer: true, vendor: true, employee: true, contact: true },
    orderBy: [{ postingDate: "desc" }, { documentNo: "asc" }, { lineNo: "asc" }],
  });

  const byDocument = new Map<string, DocumentSummary>();
  for (const entry of entries) {
    const existing = byDocument.get(entry.documentNo);
    const counterpartyName =
      entry.customer?.tradeName ??
      entry.vendor?.tradeName ??
      (entry.employee ? `${entry.employee.firstName} ${entry.employee.lastName}` : null) ??
      entry.contact?.tradeName ??
      null;

    const net = Number(entry.netAmount ?? 0);
    const vat = Number(entry.vatAmount ?? 0);
    const wtax = Number(entry.withholdingAmt ?? 0);

    if (!existing) {
      byDocument.set(entry.documentNo, {
        documentNo: entry.documentNo,
        postingDate: entry.postingDate,
        checkNo: entry.checkNo,
        particulars: entry.description,
        totalDebit: Number(entry.debitAmount),
        totalCredit: Number(entry.creditAmount),
        totalNet: net,
        totalVat: vat,
        totalWithholding: wtax,
        isCancelled: entry.isCancelled,
        lineCount: 1,
        counterpartyName,
      });
    } else {
      existing.totalDebit += Number(entry.debitAmount);
      existing.totalCredit += Number(entry.creditAmount);
      existing.totalNet += net;
      existing.totalVat += vat;
      existing.totalWithholding += wtax;
      existing.lineCount += 1;
      existing.checkNo = existing.checkNo ?? entry.checkNo;
      existing.counterpartyName = existing.counterpartyName ?? counterpartyName;
    }
  }

  // Preserve the newest-first order the docNo lookup established.
  return docNos.map((no) => byDocument.get(no)).filter((d): d is DocumentSummary => Boolean(d));
}
