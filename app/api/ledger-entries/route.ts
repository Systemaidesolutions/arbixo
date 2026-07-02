import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { JournalType } from "@prisma/client";

export type DocumentSummary = {
  documentNo: string;
  postingDate: Date;
  checkNo: string | null;
  particulars: string | null;
  totalDebit: number;
  totalCredit: number;
  isCancelled: boolean;
  lineCount: number;
  counterpartyName: string | null;
};

// Mirrors the manual's "Transaction Summary" screen: select a journal
// type and a month, get back one row per document (CV/OR/Invoice/PV/JV)
// rather than one row per ledger line.
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const journalType = request.nextUrl.searchParams.get("journalType") as JournalType | null;
  const month = request.nextUrl.searchParams.get("month"); // 1-12
  const year = request.nextUrl.searchParams.get("year");

  if (!companyId || !journalType || !month || !year) {
    return NextResponse.json(
      { error: "companyId, journalType, month, and year query parameters are required" },
      { status: 400 }
    );
  }

  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 1);

  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId, journalType, postingDate: { gte: start, lt: end } },
    include: { customer: true, vendor: true, employee: true, contact: true },
    orderBy: [{ documentNo: "asc" }, { lineNo: "asc" }],
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

    if (!existing) {
      byDocument.set(entry.documentNo, {
        documentNo: entry.documentNo,
        postingDate: entry.postingDate,
        checkNo: entry.checkNo,
        particulars: entry.description,
        totalDebit: Number(entry.debitAmount),
        totalCredit: Number(entry.creditAmount),
        isCancelled: entry.isCancelled,
        lineCount: 1,
        counterpartyName,
      });
    } else {
      existing.totalDebit += Number(entry.debitAmount);
      existing.totalCredit += Number(entry.creditAmount);
      existing.lineCount += 1;
      existing.checkNo = existing.checkNo ?? entry.checkNo;
      existing.counterpartyName = existing.counterpartyName ?? counterpartyName;
    }
  }

  return NextResponse.json({ documents: Array.from(byDocument.values()) });
}
