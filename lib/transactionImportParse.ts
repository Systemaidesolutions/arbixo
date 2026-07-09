import ExcelJS from "exceljs";

// Parsed sheet: an ordered list of rows, each a map of normalized-header -> cell
// text. Headers are normalized (lowercased, non-alphanumerics stripped) so
// "CV No.", "cv_no" and "CVNo" all collapse to "cvno".
export type SheetRow = Record<string, string>;

export const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    // ExcelJS rich text / hyperlink / formula result objects
    const o = v as { text?: string; result?: unknown; hyperlink?: string };
    if (typeof o.text === "string") return o.text;
    if (o.result != null) return String(o.result);
  }
  return String(v).trim();
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes,
// embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* ignore */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsFromMatrix(matrix: string[][]): SheetRow[] {
  const nonEmpty = matrix.filter((r) => r.some((c) => c && c.trim() !== ""));
  if (nonEmpty.length < 1) return [];
  const headers = nonEmpty[0].map((h) => normHeader(cellText(h)));
  const out: SheetRow[] = [];
  for (let r = 1; r < nonEmpty.length; r++) {
    const cells = nonEmpty[r];
    const obj: SheetRow = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = cellText(cells[i]).trim();
    });
    out.push(obj);
  }
  return out;
}

/** Parse an uploaded .csv or .xlsx file into normalized rows (first sheet). */
export async function parseImportFile(buffer: Buffer, filename: string): Promise<SheetRow[]> {
  const isCsv = /\.csv$/i.test(filename);
  if (isCsv) {
    return rowsFromMatrix(parseCsv(buffer.toString("utf8")));
  }
  const wb = new ExcelJS.Workbook();
  // exceljs bundles its own Buffer type, which differs from @types/node's.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[]; // 1-based; [0] is empty
    matrix.push(values.slice(1).map((v) => cellText(v)));
  });
  return rowsFromMatrix(matrix);
}

// ---- value coercion shared by importers ----------------------------------

export function pick(row: SheetRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[normHeader(k)];
    if (v != null && v !== "") return v;
  }
  return "";
}

export function toAmount(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function toDateStr(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  // M/D/YYYY or D/M/YYYY — assume M/D/YYYY (BIR/US-style, matches the app)
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, a, b, y] = m;
    return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function toBoolGross(s: string, def = true): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return def;
  if (["net", "no", "n", "false", "0"].includes(t)) return false;
  if (["gross", "yes", "y", "true", "1"].includes(t)) return true;
  return def;
}
