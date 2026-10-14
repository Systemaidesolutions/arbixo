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
  opts: { q?: string | null; from?: string | null; to?: string | null; limit?: number } = {}
): Promise<DocumentSummary[]> {
  const { q, from, to } = opts;
  const limit = opts.limit ?? 200;
  const term = (q ?? "").trim();
  const contains = { contains: term, mode: "insensitive" as const };

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(`${from}T00:00:00`);
  if (to) dateFilter.lte = new Date(`${to}T23:59:59.999`);
  const base = {
    companyId,
    journalType,
    ...(from || to ? { postingDate: dateFilter } : {}),
  };

  const where = term
    ? {
        ...base,
        OR: [
          { documentNo: contains },
          { description: contains },
          { lineDescription: contains },
          { referenceNo: contains },
          { checkNo: contains },
          { customer: { is: { tradeName: contains } } },
          { vendor: { is: { tradeName: contains } } },
          { contact: { is: { tradeName: contains } } },
          { employee: { is: { OR: [{ firstName: contains }, { lastName: contains }] } } },
        ],
      }
    : base;

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
  // e.description is the document-level "particulars" field, which every
  // transaction form hardcodes blank — the user-typed text lives per-line on
  // lineDescription instead. Collect it across every line of a document
  // (not just the first) since it can differ per line.
  const descByDoc = new Map<string, string[]>();
  for (const entry of entries) {
    const existing = byDocument.get(entry.documentNo);
    // Reports show the party's REGISTERED name; trade name is only a fallback.
    const reg = (p: { registeredName?: string | null; tradeName?: string | null } | null | undefined) =>
      p ? p.registeredName || p.tradeName || null : null;
    const counterpartyName =
      reg(entry.customer) ??
      reg(entry.vendor) ??
      (entry.employee ? [entry.employee.firstName, entry.employee.middleName, entry.employee.lastName].filter(Boolean).join(" ") : null) ??
      reg(entry.contact) ??
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

    if (entry.lineDescription) {
      const list = descByDoc.get(entry.documentNo) ?? [];
      if (!list.includes(entry.lineDescription)) list.push(entry.lineDescription);
      descByDoc.set(entry.documentNo, list);
    }
  }
  for (const [docNo, doc] of byDocument) {
    const descs = descByDoc.get(docNo);
    if (descs?.length) doc.particulars = descs.join("; ");
  }

  // Preserve the newest-first order the docNo lookup established.
  return docNos.map((no) => byDocument.get(no)).filter((d): d is DocumentSummary => Boolean(d));
}
