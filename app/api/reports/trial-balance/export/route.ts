import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getTrialBalance } from "@/lib/reports";
import { CLASSIFICATION_LABELS } from "@/lib/accounts";
import type { AccountClassification } from "@prisma/client";

// Streams the Trial Balance as .xlsx, formatted like the print-out: company
// letterhead, centered report title, date coverage, zebra rows, and a
// "Page N of M" footer (Excel's native page numbering).
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

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

  let result;
  let coverage: string;
  try {
    if (mode === "YEAR_TO_DATE") {
      const asOfDate = params.get("asOfDate");
      if (!asOfDate) return NextResponse.json({ error: "asOfDate is required" }, { status: 400 });
      result = await getTrialBalance(companyId, { mode, asOfDate: new Date(asOfDate) });
      coverage = `As of ${fmtDate(asOfDate)}`;
    } else {
      const dateFrom = params.get("dateFrom");
      const dateTo = params.get("dateTo");
      if (!dateFrom || !dateTo) return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
      result = await getTrialBalance(companyId, { mode, dateFrom: new Date(dateFrom), dateTo: new Date(dateTo) });
      coverage = `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const reportTitle = (params.get("title") ?? "Trial Balance").toUpperCase();
  const classifications = params.get("classifications")?.split(",").filter(Boolean) ?? null;
  const dispRows = classifications ? result.rows.filter((r) => classifications.includes(r.classification)) : result.rows;
  const totalDebit = Math.round(dispRows.reduce((s, r) => s + r.debit, 0) * 100) / 100;
  const totalCredit = Math.round(dispRows.reduce((s, r) => s + r.credit, 0) * 100) / 100;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const companyName = company?.registeredName || company?.tradeName || "";
  const addr = [company?.businessAddress, company?.barangay, company?.city, company?.province, company?.zipCode].filter(Boolean).join(", ");

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Trial Balance", {
    headerFooter: { oddFooter: "&CPage &P of &N", evenFooter: "&CPage &P of &N" },
  });
  [12, 40, 24, 16, 16].forEach((w, idx) => (ws.getColumn(idx + 1).width = w));

  // Centered, full-width header lines (company letterhead + report title).
  const heading = (text: string, font: Partial<ExcelJS.Font>) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, 5);
    const c = ws.getCell(r.number, 1);
    c.alignment = { horizontal: "center" };
    c.font = font;
  };
  heading(companyName, { bold: true, size: 12 });
  if (addr) heading(addr, { size: 9, color: { argb: "FF666666" } });
  if (company?.tin) heading(`TIN: ${company.tin}`, { size: 9, color: { argb: "FF666666" } });
  heading(reportTitle, { bold: true, size: 14 });
  heading(coverage, { size: 9, color: { argb: "FF666666" } });
  ws.addRow([]);

  const headerRow = ws.addRow(["Code", "Account", "Classification", "Debit", "Credit"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => (c.border = { bottom: { style: "thin" } }));

  let i = 0;
  for (const row of dispRows) {
    const r = ws.addRow([
      row.code,
      row.title,
      CLASSIFICATION_LABELS[row.classification as AccountClassification] ?? row.classification,
      row.debit || null,
      row.credit || null,
    ]);
    if (i++ % 2 === 1) {
      for (let col = 1; col <= 5; col++) {
        r.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      }
    }
  }
  const totalRow = ws.addRow(["", "Total", "", totalDebit, totalCredit]);
  totalRow.font = { bold: true };
  totalRow.eachCell((c) => (c.border = { top: { style: "thin" } }));

  ws.getColumn(4).numFmt = "#,##0.00";
  ws.getColumn(5).numFmt = "#,##0.00";

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trial-balance.xlsx"`,
    },
  });
}
