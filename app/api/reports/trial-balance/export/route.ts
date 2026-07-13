import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getTrialBalance } from "@/lib/reports";
import { CLASSIFICATION_LABELS } from "@/lib/accounts";
import type { AccountClassification } from "@prisma/client";

// Streams the Trial Balance (same rows as the on-screen report) as .xlsx.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const mode = params.get("mode") as "YEAR_TO_DATE" | "NET_CHANGE" | null;
  if (!companyId || !mode) {
    return NextResponse.json({ error: "companyId and mode are required" }, { status: 400 });
  }

  const user = await getCurrentUserRecord();
  if (!user?.companyId || user.companyId !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let result;
  let periodLabel: string;
  try {
    if (mode === "YEAR_TO_DATE") {
      const asOfDate = params.get("asOfDate");
      if (!asOfDate) return NextResponse.json({ error: "asOfDate is required" }, { status: 400 });
      result = await getTrialBalance(companyId, { mode, asOfDate: new Date(asOfDate) });
      periodLabel = `Year to date — as of ${asOfDate}`;
    } else {
      const dateFrom = params.get("dateFrom");
      const dateTo = params.get("dateTo");
      if (!dateFrom || !dateTo) return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
      result = await getTrialBalance(companyId, { mode, dateFrom: new Date(dateFrom), dateTo: new Date(dateTo) });
      periodLabel = `Net change — ${dateFrom} to ${dateTo}`;
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Trial Balance");
  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = "Trial Balance";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.mergeCells("A2:E2");
  ws.getCell("A2").value = periodLabel;
  ws.getCell("A2").font = { color: { argb: "FF888888" } };

  const headerRow = ws.addRow(["Code", "Account", "Classification", "Debit", "Credit"]);
  headerRow.font = { bold: true };
  ws.columns = [
    { key: "code", width: 12 },
    { key: "account", width: 40 },
    { key: "classification", width: 24 },
    { key: "debit", width: 16 },
    { key: "credit", width: 16 },
  ];

  for (const row of result.rows) {
    ws.addRow([
      row.code,
      row.title,
      CLASSIFICATION_LABELS[row.classification as AccountClassification] ?? row.classification,
      row.debit || null,
      row.credit || null,
    ]);
  }
  const totalRow = ws.addRow(["", "Total", "", result.totalDebit, result.totalCredit]);
  totalRow.font = { bold: true };

  ws.getColumn("debit").numFmt = "#,##0.00";
  ws.getColumn("credit").numFmt = "#,##0.00";

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trial-balance.xlsx"`,
    },
  });
}
