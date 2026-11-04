import { NextRequest, NextResponse } from "next/server";
import { payrollAuth } from "@/lib/payroll/server";
import { parseImportFile } from "@/lib/transactionImportParse";
import { importProfiles, profileTemplate } from "@/lib/payroll/profileImport";
import { xlsxResponse } from "@/lib/xlsxTemplate";

/** Downloads the Excel upload template. */
export async function GET() {
  return xlsxResponse(await profileTemplate(), "payroll-employee-import-template.xlsx");
}

/** Preview (dryRun=1) or import payroll employee records from an uploaded .xlsx/.csv. */
export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (!/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ error: "Upload an .xlsx or .csv file." }, { status: 400 });
  if (file.size > 5_000_000) return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 400 });
  let rows;
  try { rows = await parseImportFile(Buffer.from(await file.arrayBuffer()), file.name); }
  catch { return NextResponse.json({ error: "Could not read the file. Use the template's .xlsx or a CSV." }, { status: 400 }); }
  if (rows.length === 0) return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ error: "Too many rows (max 5,000)." }, { status: 400 });
  return NextResponse.json(await importProfiles(auth.companyId, rows, form?.get("dryRun") === "1"));
}
