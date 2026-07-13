import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { JournalType } from "@prisma/client";
import type { DocumentSummary } from "@/app/api/ledger-entries/route";

// Free-text lookup for a journal's posted documents. Matches on document
// no., line description, per-line reference no., check no., or the
// counterparty's name, then returns one summary row per document (newest
// first) — the shape the transaction screens' search popup renders.
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const journalType = request.nextUrl.searchParams.get("journalType") as JournalType | null;
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!companyId || !journalType || !q) {
    return NextResponse.json(
      { error: "companyId, journalType, and q query parameters are required" },
      { status: 400 }
    );
  }

  const contains = { contains: q, mode: "insensitive" as const };
  const hits = await prisma.ledgerEntry.findMany({
    where: {
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
    },
    select: { documentNo: true },
    orderBy: { postingDate: "desc" },
    take: 300,
  });

  const docNos = [...new Set(hits.map((h) => h.documentNo))].slice(0, 50);
  if (docNos.length === 0) return NextResponse.json({ documents: [] });

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

  // Keep the newest-first order the docNo lookup already established.
  const documents = docNos.map((no) => byDocument.get(no)).filter(Boolean);
  return NextResponse.json({ documents });
}
