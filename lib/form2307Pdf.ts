import { PDFDocument, PDFFont, PDFPage, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { formatPeso } from "./format";

// BIR Form No. 2307 (January 2018 ENCS) rendered by stamping computed values
// onto BIR's own blank PDF (assets/bir-2307-template.pdf) instead of trying to
// redraw the form's grid in HTML/CSS. Coordinates below were calibrated
// directly against that template's vector geometry (page is 612x936pt) and
// are only valid for that exact file — if the template is ever replaced,
// these need to be re-derived.

export type Row2307 = {
  atc: string;
  description: string;
  income: number;
  tax: number;
  /** Income split across the quarter's three months (report certificates). */
  months?: [number, number, number];
};
export type Party2307 = { name: string; tin: string; address: string; zip?: string };
export type Form2307Data = {
  payee: Party2307;
  payor: Party2307;
  postingDate: string; // yyyy-mm-dd — used to derive the quarter/period
  documentNo: string;
  rows: Row2307[];
  periodFrom?: string;
  periodTo?: string;
};

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "bir-2307-template.pdf");

// 3-3-3-5 digit groups, dash-separated (TIN + branch code).
const TIN_GROUPS = [
  { x: 207.3, w: 39.6, n: 3 },
  { x: 258.9, w: 39.6, n: 3 },
  { x: 310.2, w: 39.6, n: 3 },
  { x: 361.5, w: 74.0, n: 5 },
];

const ZIP_BOX = { x: 541.8, w: 50.0, n: 4 };

// "For the Period" date boxes: MM+DD (4 cells) then YYYY (4 cells).
const PERIOD_FROM = { mmdd: { x: 151.5, w: 52.6 }, yyyy: { x: 204.1, w: 52.6 } };
const PERIOD_TO = { mmdd: { x: 399.1, w: 52.7 }, yyyy: { x: 451.8, w: 52.7 } };

// Part III table column x-ranges [start, end].
const COLS = {
  desc: [21.0, 175.0],
  atc: [176.9, 220.1],
  m: [
    [220.1, 292.1],
    [292.1, 366.4],
    [366.4, 438.5],
  ],
  total: [438.5, 510.5],
  tax: [510.5, 594.5],
};
const ROW_TOP = 570.2; // top edge (y) of the first EWT detail row
const ROW_H = 13.68; // 10 detail rows + 1 total row, all this height
const EWT_LINES = 10;

const PAGE_CENTER_X = 308;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Standard fonts here are WinAnsi-encoded (~CP1252) and throw on anything
// outside it — e.g. the peso sign (₱, U+20B1) used in seeded ATC
// descriptions. Swap known offenders for ASCII equivalents, then drop
// whatever's left rather than let one bad character 500 the whole PDF.
const CHAR_REPLACEMENTS: [string, string][] = [
  ["₱", "P"], // ₱
  ["‘", "'"], ["’", "'"], // ‘ ’
  ["“", '"'], ["”", '"'], // “ ”
  ["–", "-"], ["—", "-"], // – —
  ["…", "..."], // …
];
function safeText(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [from, to] of CHAR_REPLACEMENTS) out = out.split(from).join(to);
  return out.replace(/[^\x00-\xFF]/g, "");
}

function centerText(page: PDFPage, font: PDFFont, size: number, text: string, cx: number, y: number) {
  if (!text) return;
  const t = safeText(text);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: cx - w / 2, y, size, font });
}

function rightText(page: PDFPage, font: PDFFont, size: number, text: string, rightX: number, y: number) {
  if (!text) return;
  const t = safeText(text);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: rightX - w, y, size, font });
}

// Left-aligned text that shrinks to fit maxWidth, then truncates with an
// ellipsis if it still doesn't fit at the smallest readable size — long ATC
// descriptions would otherwise spill into the next column.
function fitText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, maxWidth: number, size = 8, minSize = 5.5) {
  if (!text) return;
  let t = safeText(text);
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(t, s) > maxWidth) s -= 0.5;
  if (font.widthOfTextAtSize(t, s) > maxWidth) {
    // Three literal periods, not the "…" glyph — that's outside WinAnsi too.
    while (t.length > 1 && font.widthOfTextAtSize(t + "...", s) > maxWidth) t = t.slice(0, -1);
    t = t + "...";
  }
  page.drawText(t, { x, y, size: s, font });
}

// One digit per evenly-divided cell within [x, x+w).
function drawCells(page: PDFPage, font: PDFFont, size: number, value: string, x: number, w: number, count: number, y: number) {
  const cellW = w / count;
  const chars = safeText(value ?? "").split("");
  for (let i = 0; i < count; i++) {
    const ch = chars[i];
    if (!ch) continue;
    centerText(page, font, size, ch, x + cellW * (i + 0.5), y);
  }
}

function drawTin(page: PDFPage, font: PDFFont, tin: string, y: number) {
  const digits = (tin || "").replace(/\D/g, "");
  let offset = 0;
  for (const g of TIN_GROUPS) {
    drawCells(page, font, 8, digits.slice(offset, offset + g.n), g.x, g.w, g.n, y);
    offset += g.n;
  }
}

function drawDate(page: PDFPage, font: PDFFont, d: Date | null, box: typeof PERIOD_FROM, y: number) {
  if (!d) return;
  const mmdd = pad2(d.getMonth() + 1) + pad2(d.getDate());
  drawCells(page, font, 8, mmdd, box.mmdd.x, box.mmdd.w, 4, y);
  drawCells(page, font, 8, String(d.getFullYear()), box.yyyy.x, box.yyyy.w, 4, y);
}

function rowBaseline(i: number): number {
  return ROW_TOP - ROW_H * (i + 1) + 4;
}

function drawPage1(page: PDFPage, font: PDFFont, bold: PDFFont, data: Form2307Data) {
  const { payee, payor, rows } = data;
  const d = new Date(`${data.postingDate}T00:00:00`);
  const q = Math.floor(d.getMonth() / 3);
  const monthCol = d.getMonth() % 3;
  const periodFrom = data.periodFrom ? new Date(`${data.periodFrom}T00:00:00`) : new Date(d.getFullYear(), q * 3, 1);
  const periodTo = data.periodTo ? new Date(`${data.periodTo}T00:00:00`) : new Date(d.getFullYear(), q * 3 + 3, 0);
  const amt = (n: number) => (n ? formatPeso(n) : "");

  // 1 — For the Period
  drawDate(page, font, periodFrom, PERIOD_FROM, 817.5);
  drawDate(page, font, periodTo, PERIOD_TO, 817.5);

  // Part I — Payee
  drawTin(page, font, payee.tin, 787.1);
  fitText(page, bold, (payee.name || "").toUpperCase(), 36, 760.8, 554);
  fitText(page, font, (payee.address || "").toUpperCase(), 37, 731.6, 497);
  drawCells(page, font, 8, payee.zip ?? "", ZIP_BOX.x, ZIP_BOX.w, ZIP_BOX.n, 731.4);

  // Part II — Payor
  drawTin(page, font, payor.tin, 671.5);
  fitText(page, bold, (payor.name || "").toUpperCase(), 36, 645.6, 554);
  fitText(page, font, (payor.address || "").toUpperCase(), 37, 616.4, 497);
  drawCells(page, font, 8, payor.zip ?? "", ZIP_BOX.x, ZIP_BOX.w, ZIP_BOX.n, 616.2);

  // Part III — detail rows (pad to the form's 10 printed lines).
  const ewtRows = [...rows];
  while (ewtRows.length < EWT_LINES) ewtRows.push({ atc: "", description: "", income: 0, tax: 0 });
  let totalIncome = 0;
  let totalTax = 0;
  ewtRows.slice(0, EWT_LINES).forEach((r, i) => {
    const y = rowBaseline(i);
    fitText(page, font, r.description, COLS.desc[0], y, COLS.desc[1] - COLS.desc[0], 6.5);
    centerText(page, font, 6.5, r.atc, (COLS.atc[0] + COLS.atc[1]) / 2, y);
    for (let c = 0; c < 3; c++) {
      const v = r.months ? r.months[c] : r.income && c === monthCol ? r.income : 0;
      rightText(page, font, 6.5, amt(v), COLS.m[c][1] - 3, y);
    }
    rightText(page, font, 6.5, amt(r.income), COLS.total[1] - 3, y);
    rightText(page, font, 6.5, amt(r.tax), COLS.tax[1] - 3, y);
    totalIncome += r.income;
    totalTax += r.tax;
  });
  const totalY = rowBaseline(EWT_LINES);
  rightText(page, bold, 7, amt(totalIncome), COLS.total[1] - 3, totalY);
  rightText(page, bold, 7, amt(totalTax), COLS.tax[1] - 3, totalY);

  // Signature blocks — printed name only; dates/accreditation are left blank
  // (not tracked by the app, matching the previous HTML layout's behaviour).
  centerText(page, bold, 8, (payor.name || "").toUpperCase(), PAGE_CENTER_X, 187);
  centerText(page, bold, 8, (payee.name || "").toUpperCase(), PAGE_CENTER_X, 109.8);
}

/**
 * Renders one or more BIR Form 2307 certificates by stamping values onto
 * BIR's own blank PDF. Each certificate contributes 2 pages: the filled
 * certificate (page 1) and the form's own ATC schedule (page 2, unchanged).
 */
export async function renderForm2307Pdf(certs: Form2307Data[]): Promise<Uint8Array> {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const output = await PDFDocument.create();

  for (const data of certs) {
    const src = await PDFDocument.load(templateBytes);
    const font = await src.embedFont(StandardFonts.Helvetica);
    const bold = await src.embedFont(StandardFonts.HelveticaBold);
    const [page1] = src.getPages();
    drawPage1(page1, font, bold, data);

    const copied = await output.copyPages(src, [0, 1]);
    for (const p of copied) output.addPage(p);
  }

  return output.save();
}
