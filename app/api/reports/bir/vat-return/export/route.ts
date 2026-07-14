import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getVatReturn } from "@/lib/bir";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Streams the VAT Return as .xlsx, formatted like the print-out: company
// letterhead, centered report title, period coverage, and a "Page N of M"
// footer. Carried-over input tax (17A) is passed through so totals match
// the on-screen figures.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const carryover = Number(params.get("carryover")) || 0;
  if (!companyId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "companyId, dateFrom, and dateTo are required" }, { status: 400 });
  }

  const user = await getCurrentUserRecord();
  if (!user?.companyId || user.companyId !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getVatReturn(companyId, new Date(`${dateFrom}T00:00:00`), new Date(`${dateTo}T23:59:59.999`));
  const totalAllowableInputTax = Math.max(0, data.totalCurrentInputTax + carryover);
  const vatPayable = round2(data.outputTax - totalAllowableInputTax);
  const excessInputTax = vatPayable < 0 ? round2(-vatPayable) : 0;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const companyName = company?.registeredName || company?.tradeName || "";
  const addr = [company?.businessAddress, company?.barangay, company?.city, company?.province, company?.zipCode].filter(Boolean).join(", ");
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = params.get("label") ? `For ${params.get("label")}` : `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("VAT Return", {
    headerFooter: { oddFooter: "&CPage &P of &N", evenFooter: "&CPage &P of &N" },
  });
  [12, 50, 18].forEach((w, idx) => (ws.getColumn(idx + 1).width = w));

  const heading = (text: string, font: Partial<ExcelJS.Font>) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, 3);
    const c = ws.getCell(r.number, 1);
    c.alignment = { horizontal: "center" };
    c.font = font;
  };
  heading(companyName, { bold: true, size: 12 });
  if (addr) heading(addr, { size: 9, color: { argb: "FF666666" } });
  if (company?.tin) heading(`TIN: ${company.tin}`, { size: 9, color: { argb: "FF666666" } });
  heading("VAT RETURN", { bold: true, size: 14 });
  heading(coverage, { size: 9, color: { argb: "FF666666" } });
  ws.addRow([]);

  const sectionRow = (text: string) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, 3);
    r.getCell(1).font = { bold: true, size: 10 };
  };
  const dataRow = (line: string, desc: string, amount: number, opts: { bold?: boolean; topBorder?: boolean } = {}) => {
    const r = ws.addRow([line, desc, amount]);
    if (opts.bold) r.font = { bold: true };
    if (opts.topBorder) r.eachCell((c) => (c.border = { top: { style: "thin" } }));
    r.getCell(3).numFmt = "#,##0.00";
  };

  const headerRow = ws.addRow(["Line", "Description", "Amount"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => (c.border = { bottom: { style: "thin" } }));

  sectionRow("Sales/receipts for the month");
  dataRow("12A", "Vatable sales/receipts — Private", data.vatableSalesPrivate);
  dataRow("13", "Sales to Government", data.salesToGovernment);
  dataRow("14", "Zero-rated sales/receipts", data.zeroRatedSales);
  dataRow("15", "Exempt sales/receipts", data.exemptSales);
  dataRow("16A", "Total sales/receipts", data.totalSales, { bold: true, topBorder: true });
  dataRow("16B", "Output tax due", data.outputTax, { bold: true });

  sectionRow("Purchases for the month");
  dataRow("18A", "Purchase of capital goods (net)", data.capitalGoodsPurchases);
  dataRow("18B", "Purchase of capital goods (input tax)", data.capitalGoodsInputTax);
  dataRow("19A", "Other purchases (net)", data.otherPurchases);
  dataRow("19B", "Other purchases (input tax)", data.otherInputTax);
  dataRow("", "Total current input tax", data.totalCurrentInputTax, { bold: true, topBorder: true });
  dataRow("17A", "Input tax carried over from previous period", carryover);
  dataRow("17F", "Total allowable input tax", totalAllowableInputTax, { bold: true });

  dataRow(
    "",
    vatPayable > 0 ? "VAT Payable" : "Excess Input Tax (carry to next period)",
    vatPayable > 0 ? vatPayable : excessInputTax,
    { bold: true, topBorder: true }
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vat-return_${dateFrom}_to_${dateTo}.xlsx"`,
    },
  });
}
