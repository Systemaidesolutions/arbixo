import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getExpandedWithholding } from "@/lib/ewt";
import { computeEwt1601, emptyEwt1601Manual, EWT_1601_LABELS, type Ewt1601Manual } from "@/lib/ewt1601eq";

function parseManual(raw: string | null): Ewt1601Manual {
  const base = emptyEwt1601Manual();
  if (!raw) return base;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const k of Object.keys(base) as (keyof Ewt1601Manual)[]) {
      const v = Number(obj[k]);
      if (Number.isFinite(v)) base[k] = v;
    }
  } catch {
    // ignore malformed adj param
  }
  return base;
}

// Streams the Expanded Withholding Tax return (BIR 1601-EQ, Part II) as .xlsx:
// company letterhead, the per-ATC breakdown (13-18), and the computation (19-30).
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
  const data = await getExpandedWithholding(companyId, new Date(`${dateFrom}T00:00:00`), new Date(`${dateTo}T23:59:59.999`));
  const T = computeEwt1601(data.totalWithheld, manual);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const companyName = company?.registeredName || company?.tradeName || "";
  const addr = [company?.businessAddress, company?.barangay, company?.city, company?.province, company?.zipCode].filter(Boolean).join(", ");
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = params.get("label") ? `For ${params.get("label")}` : `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Expanded Withholding Tax", {
    headerFooter: { oddFooter: "&CPage &P of &N", evenFooter: "&CPage &P of &N" },
  });
  [8, 52, 18, 12, 18].forEach((w, idx) => (ws.getColumn(idx + 1).width = w));

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
  heading("EXPANDED WITHHOLDING TAX", { bold: true, size: 14 });
  heading(coverage, { size: 9, color: { argb: "FF666666" } });
  ws.addRow([]);

  // ATC breakdown (13-18)
  const atcHeader = ws.addRow(["#", "ATC", "Tax Base", "Rate (%)", "Tax Withheld"]);
  atcHeader.font = { bold: true };
  atcHeader.eachCell((c) => (c.border = { bottom: { style: "thin" } }));
  if (data.rows.length === 0) {
    ws.addRow(["", "No withholding for this period", null, null, null]);
  } else {
    data.rows.forEach((r, i) => {
      const row = ws.addRow([13 + i, `${r.atcCode}${r.atcDescription ? ` — ${r.atcDescription}` : ""}`, r.taxBase, r.ratePercent, r.taxWithheld]);
      row.getCell(3).numFmt = "#,##0.00";
      row.getCell(4).numFmt = "0.00";
      row.getCell(5).numFmt = "#,##0.00";
    });
  }
  ws.addRow([]);

  // Computation (19-30)
  const line = (n: string, amount: number, opts: { bold?: boolean; topBorder?: boolean } = {}) => {
    const r = ws.addRow([n, EWT_1601_LABELS[n], null, null, amount]);
    if (opts.bold) r.font = { bold: true };
    if (opts.topBorder) r.eachCell((c) => (c.border = { top: { style: "thin" } }));
    r.getCell(5).numFmt = "#,##0.00";
  };
  line("19", T.l19, { bold: true });
  line("20", manual.l20);
  line("21", manual.l21);
  line("22", manual.l22);
  line("23", manual.l23);
  line("24", T.l24, { bold: true, topBorder: true });
  line("25", T.l25, { bold: true });
  line("26", manual.l26);
  line("27", manual.l27);
  line("28", manual.l28);
  line("29", T.l29, { bold: true, topBorder: true });
  line("30", T.l30, { bold: true, topBorder: true });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="expanded-withholding_${dateFrom}_to_${dateTo}.xlsx"`,
    },
  });
}
