import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { searchLedgerDocuments } from "@/lib/ledgerSearch";
import { listAttachments } from "@/lib/transactionAttachments";
import type { JournalType } from "@prisma/client";

const TITLES: Partial<Record<JournalType, string>> = {
  CASH_RECEIPT: "Cash Receipts",
  CASH_DISBURSEMENT: "Cash Disbursement",
  SALES_ON_ACCOUNT: "Sales on Account",
  PURCHASE_ON_ACCOUNT: "Purchase on Account",
  GENERAL_JOURNAL: "General Journal",
};

// Streams the transaction summary (same rows as the search popup) as .xlsx.
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const journalType = request.nextUrl.searchParams.get("journalType") as JournalType | null;
  const q = request.nextUrl.searchParams.get("q");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!companyId || !journalType) {
    return NextResponse.json({ error: "companyId and journalType are required" }, { status: 400 });
  }

  const user = await getCurrentUserRecord();
  if (!user?.companyId || user.companyId !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await searchLedgerDocuments(companyId, journalType, { q, from, to, limit: 1000 });
  const attByDoc = await listAttachments(companyId, journalType, documents.map((d) => d.documentNo));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(TITLES[journalType] ?? "Transactions");
  ws.columns = [
    { header: "Doc No.", key: "documentNo", width: 16 },
    { header: "Date", key: "date", width: 12 },
    { header: "Party", key: "party", width: 28 },
    { header: "Particulars", key: "particulars", width: 40 },
    { header: "Net", key: "net", width: 14 },
    { header: "VAT", key: "vat", width: 14 },
    { header: "W/Tax", key: "wtax", width: 14 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Attachments", key: "attachments", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const d of documents) {
    ws.addRow({
      documentNo: d.documentNo,
      date: new Date(d.postingDate).toISOString().slice(0, 10),
      party: d.counterpartyName ?? "",
      particulars: d.particulars ?? "",
      net: d.totalNet,
      vat: d.totalVat,
      wtax: d.totalWithholding,
      amount: Math.max(d.totalDebit, d.totalCredit),
      status: d.isCancelled ? "Cancelled" : "Posted",
      attachments: (attByDoc[d.documentNo] ?? []).map((a) => a.fileName).join("; "),
    });
  }

  ["net", "vat", "wtax", "amount"].forEach((key) => {
    ws.getColumn(key).numFmt = "#,##0.00";
  });

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `${(TITLES[journalType] ?? "transactions").replace(/\s+/g, "-").toLowerCase()}-summary.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
