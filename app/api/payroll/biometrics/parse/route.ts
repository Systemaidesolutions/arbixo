import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { payrollAuth } from "@/lib/payroll/server";
import { splitText, type Grid } from "@/lib/payroll/biometric";

// Reads a biometric export into a text grid for the import panel, which maps
// the columns and computes attendance in the browser. Text files (CSV/TXT/DAT)
// are split here too so UTF-16 exports (common on device software) decode right.

const pad = (n: number) => String(n).padStart(2, "0");

/** ExcelJS gives date/time cells as Dates holding the sheet's face value in UTC. */
function cell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const d = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    const t = `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
    // Time-only cells sit on Excel's 1899-12-30 epoch.
    return d === "1899-12-30" ? t : t === "00:00:00" ? d : `${d} ${t}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof o.text === "string") return o.text;
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.result != null) return cell(o.result);
  }
  return String(v).trim();
}

function decode(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
  return buf.toString("utf8");
}

export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > 10_000_000) return NextResponse.json({ error: "File too large (max 10 MB)." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  let grid: Grid;
  try {
    if (/\.xlsx$/i.test(file.name)) {
      const wb = new ExcelJS.Workbook();
      // exceljs bundles its own Buffer type, which differs from @types/node's.
      await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
      const ws = wb.worksheets[0];
      grid = [];
      ws?.eachRow({ includeEmpty: false }, (row) => {
        grid.push((row.values as unknown[]).slice(1).map(cell));
      });
    } else if (/\.xls$/i.test(file.name)) {
      return NextResponse.json({ error: "Old .xls files aren't supported. Save it as .xlsx or CSV and try again." }, { status: 400 });
    } else {
      grid = splitText(decode(buf));
    }
  } catch {
    return NextResponse.json({ error: "Could not read the file. Use the device's CSV/TXT/DAT export or an .xlsx file." }, { status: 400 });
  }
  grid = grid.filter((r) => r.some((c) => c.trim() !== ""));
  if (grid.length === 0) return NextResponse.json({ error: "The file has no rows." }, { status: 400 });
  if (grid.length > 100_000) return NextResponse.json({ error: "Too many rows (max 100,000). Export only the payroll period." }, { status: 400 });
  return NextResponse.json({ grid });
}
