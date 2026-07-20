import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUserRecord } from "@/lib/currentUser";

// Generic grid → .xlsx exporter. Clients POST the same rows they used to build
// a CSV; this turns them into a real Excel file. A cell is treated as a money
// value (and formatted #,##0.00) only when it's a number or a plain 2-decimal
// string like "1234.56" / "0.00" — so document numbers, codes, TINs and dates
// stay as text.
const MONEY_STR = /^-?\d+\.\d{2}$/;
const NUM_FMT = "#,##0.00";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user?.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { filename?: string; sheetName?: string; rows?: unknown[][] }
    | null;
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows are required" }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((body.sheetName || "Sheet1").slice(0, 31));
  const widths: number[] = [];

  for (const raw of body.rows) {
    const cells = (Array.isArray(raw) ? raw : []).map((v) => {
      if (typeof v === "number") return v;
      if (typeof v === "string" && MONEY_STR.test(v)) return Number(v);
      return v ?? "";
    });
    const row = ws.addRow(cells);
    row.eachCell((cell, col) => {
      if (typeof cells[col - 1] === "number") cell.numFmt = NUM_FMT;
      const len = String(cell.text ?? "").length;
      widths[col - 1] = Math.min(60, Math.max(widths[col - 1] ?? 8, len + 2));
    });
  }
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const buffer = await wb.xlsx.writeBuffer();
  const base = (body.filename || "export").replace(/[^\w.\-]+/g, "_").replace(/\.xlsx$/i, "");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
}
