import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getSalesSubsidiaryJournal } from "@/lib/salesSubsidiaryJournal";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const user = await getCurrentUserRecord();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = user.companyId;

  const data = await getSalesSubsidiaryJournal(companyId, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`));
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const companyName = company?.registeredName || company?.tradeName || "";
  const addr = [company?.businessAddress, company?.barangay, company?.city, company?.province, company?.zipCode].filter(Boolean).join(", ");
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = `For the period ${fmt(from)} to ${fmt(to)}`;
  const rowDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sales Subsidiary Journal", {
    headerFooter: { oddFooter: "&CPage &P of &N", evenFooter: "&CPage &P of &N" },
  });
  [12, 34, 5, 14, 14, 12, 12, 12, 12, 14, 12, 12, 12, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const heading = (text: string, font: Partial<ExcelJS.Font>) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, 14);
    const c = ws.getCell(r.number, 1);
    c.alignment = { horizontal: "center" };
    c.font = font;
  };
  heading(companyName, { bold: true, size: 12 });
  if (addr) heading(addr, { size: 9, color: { argb: "FF666666" } });
  if (company?.tin) heading(`TIN: ${company.tin}`, { size: 9, color: { argb: "FF666666" } });
  heading("SALES SUBSIDIARY JOURNAL", { bold: true, size: 14 });
  heading(coverage, { size: 9, color: { argb: "FF666666" } });
  ws.addRow([]);

  // Two-row grouped header.
  const hr1 = ws.addRow(["Date", "Name and Address of Buyers", "F", "Invoice Numbers", "VAT Reg. No.", "Sales", "Taxable Sales", "", "VAT Output Tax", "Total Invoice Amount", "Classification of Sales", "", "Terms", ""]);
  const hr2 = ws.addRow(["", "", "", "", "", "Exempted", "12%", "Zero Rated", "", "", "Local", "Service", "Cash", "Account"]);
  const r1 = hr1.number;
  const r2 = hr2.number;
  ws.mergeCells(r1, 1, r2, 1);
  ws.mergeCells(r1, 2, r2, 2);
  ws.mergeCells(r1, 3, r2, 3);
  ws.mergeCells(r1, 4, r2, 4);
  ws.mergeCells(r1, 5, r2, 5);
  ws.mergeCells(r1, 7, r1, 8); // Taxable Sales
  ws.mergeCells(r1, 9, r2, 9);
  ws.mergeCells(r1, 10, r2, 10);
  ws.mergeCells(r1, 11, r1, 12); // Classification of Sales
  ws.mergeCells(r1, 13, r1, 14); // Terms
  for (const r of [hr1, hr2]) {
    r.font = { bold: true, size: 10 };
    r.eachCell((c) => {
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  }

  const NUM = "#,##0.00";
  const amt = (v: number) => (v ? v : null);
  for (const r of data.rows) {
    const row = ws.addRow([
      rowDate(r.postingDate),
      [r.buyerName, r.buyerAddress].filter(Boolean).join("\n"),
      "",
      r.documentNo,
      r.vatRegNo,
      amt(r.exempt),
      amt(r.vatable12),
      amt(r.zeroRated),
      amt(r.outputTax),
      amt(r.totalInvoice),
      amt(r.local),
      amt(r.service),
      r.terms === "Cash" ? amt(r.totalInvoice) : null,
      r.terms === "Account" ? amt(r.totalInvoice) : null,
    ]);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    for (let c = 6; c <= 14; c++) row.getCell(c).numFmt = NUM;
  }

  const cashTotal = data.rows.filter((r) => r.terms === "Cash").reduce((s, r) => s + r.totalInvoice, 0);
  const acctTotal = data.rows.filter((r) => r.terms === "Account").reduce((s, r) => s + r.totalInvoice, 0);
  const t = data.totals;
  const totalRow = ws.addRow(["TOTAL", "", "", "", "", t.exempt, t.vatable12, t.zeroRated, t.outputTax, t.totalInvoice, t.local, t.service, cashTotal, acctTotal]);
  totalRow.font = { bold: true };
  ws.mergeCells(totalRow.number, 1, totalRow.number, 5);
  for (let c = 6; c <= 14; c++) {
    totalRow.getCell(c).numFmt = NUM;
    totalRow.getCell(c).border = { top: { style: "thin" } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sales-subsidiary-journal_${from}_to_${to}.xlsx"`,
    },
  });
}
