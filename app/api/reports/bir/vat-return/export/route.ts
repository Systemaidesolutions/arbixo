import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getVatReturn, computeVat2550Q, emptyVat2550QManual, type Vat2550QManual } from "@/lib/bir";

function parseManual(raw: string | null): Vat2550QManual {
  const base = emptyVat2550QManual();
  if (!raw) return base;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const k of Object.keys(base) as (keyof Vat2550QManual)[]) {
      const v = Number(obj[k]);
      if (Number.isFinite(v)) base[k] = v;
    }
  } catch {
    // ignore malformed adj param
  }
  return base;
}

// Streams the VAT Return (BIR Form 2550Q, Part IV) as .xlsx: company
// letterhead, "VAT RETURN" title, period coverage, the full line-31-to-61
// computation, and a "Page N of M" footer. Manual adjustment lines arrive in
// the `adj` param so the file matches the on-screen figures.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  if (!companyId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "companyId, dateFrom, and dateTo are required" }, { status: 400 });
  }

  const user = await getCurrentUserRecord();
  if (!user?.companyId || user.companyId !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const manual = parseManual(params.get("adj"));
  const base = await getVatReturn(companyId, new Date(`${dateFrom}T00:00:00`), new Date(`${dateTo}T23:59:59.999`));
  const L = computeVat2550Q(base, manual);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const companyName = company?.registeredName || company?.tradeName || "";
  const addr = [company?.businessAddress, company?.barangay, company?.city, company?.province, company?.zipCode].filter(Boolean).join(", ");
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = params.get("label") ? `For ${params.get("label")}` : `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("VAT Return", {
    headerFooter: { oddFooter: "&CPage &P of &N", evenFooter: "&CPage &P of &N" },
  });
  [8, 56, 18, 18].forEach((w, idx) => (ws.getColumn(idx + 1).width = w));

  const heading = (text: string, font: Partial<ExcelJS.Font>) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, 4);
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

  const headerRow = ws.addRow(["#", "Details of VAT Computation", "Sales / Purchases", "Output / Input Tax"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => (c.border = { bottom: { style: "thin" } }));

  const section = (t: string) => {
    const r = ws.addRow([t]);
    ws.mergeCells(r.number, 1, r.number, 4);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  };
  const line = (n: string, desc: string, a: number | null, b: number | null, opts: { bold?: boolean; topBorder?: boolean } = {}) => {
    const r = ws.addRow([n, desc, a, b]);
    if (opts.bold) r.font = { bold: true };
    if (opts.topBorder) r.eachCell((c) => (c.border = { top: { style: "thin" } }));
    r.getCell(3).numFmt = "#,##0.00";
    r.getCell(4).numFmt = "#,##0.00";
  };

  section("Total Sales and Output Tax");
  line("31", "VATable Sales", L.l31A, L.l31B);
  line("32", "Zero-Rated Sales", L.l32A, null);
  line("33", "Exempt Sales", L.l33A, null);
  line("34", "Total Sales and Output Tax Due", L.l34A, L.l34B, { bold: true, topBorder: true });
  line("35", "Less: Output VAT on Uncollected Receivables", null, manual.l35);
  line("36", "Add: Output VAT on Recovered Uncollected Receivables Previously Deducted", null, manual.l36);
  line("37", "Total Adjusted Output Tax Due", null, L.l37B, { bold: true });

  section("Less: Allowable Input Tax");
  line("38", "Input Tax Carried Over from Previous Quarter", null, manual.l38);
  line("39", "Input Tax Deferred on Capital Goods Exceeding P1M from Previous Quarter", null, manual.l39);
  line("40", "Transitional Input Tax", null, manual.l40);
  line("41", "Presumptive Input Tax", null, manual.l41);
  line("42", "Others", null, manual.l42);
  line("43", "Total Allowable Input Tax (Sum of Items 38 to 42)", null, L.l43B, { bold: true, topBorder: true });

  section("Current Transactions");
  line("44", "Domestic Purchases", L.l44A, L.l44B);
  line("45", "Services Rendered by Non-Residents", manual.l45A, manual.l45B);
  line("46", "Importations", manual.l46A, manual.l46B);
  line("47", "Others", manual.l47A, manual.l47B);
  line("48", "Domestic Purchases with No Input Tax", manual.l48A, null);
  line("49", "VAT-Exempt Importations", manual.l49A, null);
  line("50", "Total Current Purchases / Input Tax", L.l50A, L.l50B, { bold: true, topBorder: true });
  line("51", "Total Available Input Tax", null, L.l51B, { bold: true });

  section("Less: Adjustments / Deductions from Input Tax");
  line("52", "Input Tax on Capital Goods exceeding P1M deferred for the succeeding period", null, manual.l52);
  line("53", "Input Tax Attributable to VAT-Exempt Sales", null, manual.l53);
  line("54", "VAT Refund / TCC Claimed", null, manual.l54);
  line("55", "Input VAT on Unpaid Payables", null, manual.l55);
  line("56", "Others", null, manual.l56);
  line("57", "Total Deductions from Input Tax (Sum of Items 52 to 56)", null, L.l57B, { bold: true, topBorder: true });
  line("58", "Add: Input VAT on Settled Unpaid Payables Previously Deducted", null, manual.l58);
  line("59", "Adjusted Deductions from Input Tax", null, L.l59B, { bold: true });
  line("60", "Total Allowable Input Tax", null, L.l60B, { bold: true });
  line(
    "61",
    L.l61B >= 0 ? "Net VAT Payable" : "Excess Input Tax (carry to next period)",
    null,
    Math.abs(L.l61B),
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
