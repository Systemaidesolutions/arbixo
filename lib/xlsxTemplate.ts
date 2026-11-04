import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

// Builds a downloadable .xlsx upload template: the first sheet holds the
// column headers (row 1, which the importer reads) plus example rows; a second
// "Instructions" sheet explains each column. Columns marked `text` are
// formatted as text so IDs keep leading zeros and times stay "08:00".

export type TemplateColumn = {
  header: string;
  note: string; // what goes in the column (shown on the Instructions sheet and as a header comment)
  required?: boolean;
  text?: boolean;
  width?: number;
  choices?: string[]; // dropdown values on the data sheet
};

export async function buildTemplate(opts: {
  sheetName: string;
  title: string;
  intro: string[];
  columns: TemplateColumn[];
  examples: string[][];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ARbixo";
  const ws = wb.addWorksheet(opts.sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = opts.columns.map((c) => ({ header: c.header, key: c.header, width: c.width ?? Math.max(12, c.header.length + 4) }));

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.alignment = { vertical: "middle" };
  head.height = 20;
  opts.columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? "FF1F3A68" : "FF4B6A9B" } };
    cell.note = `${c.required ? "Required. " : ""}${c.note}`;
  });

  for (const ex of opts.examples) ws.addRow(ex);

  // Text format and dropdowns for the first 1,000 data rows.
  opts.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    for (let r = 2; r <= 1001; r++) {
      const cell = ws.getCell(r, i + 1);
      if (c.text) cell.numFmt = "@";
      if (c.choices?.length) {
        cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${c.choices.join(",")}"`], showErrorMessage: false };
      }
    }
    if (c.text) col.numFmt = "@";
  });

  const info = wb.addWorksheet("Instructions");
  info.columns = [{ width: 24 }, { width: 12 }, { width: 90 }];
  info.addRow([opts.title]).font = { bold: true, size: 14 };
  for (const line of opts.intro) info.addRow([line]);
  info.addRow([]);
  const h = info.addRow(["Column", "Required", "What to enter"]);
  h.font = { bold: true };
  for (const c of opts.columns) {
    const r = info.addRow([c.header, c.required ? "Yes" : "", c.note + (c.choices?.length ? ` Choices: ${c.choices.join(", ")}.` : "")]);
    r.alignment = { wrapText: true, vertical: "top" };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buf: Buffer, filename: string) {
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Yes/No-style cell → boolean, or null when blank/unrecognized. */
export function toYesNo(s: string): boolean | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (["y", "yes", "true", "1", "x", "oo"].includes(t)) return true;
  if (["n", "no", "false", "0", "hindi"].includes(t)) return false;
  return null;
}
