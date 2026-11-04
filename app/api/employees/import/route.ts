import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId, resolvePoster } from "@/lib/currentUser";
import { parseImportFile } from "@/lib/transactionImportParse";
import { employeeTemplate, importEmployees } from "@/lib/employeeImport";
import { xlsxResponse } from "@/lib/xlsxTemplate";

/** Downloads the Excel upload template. */
export async function GET() {
  return xlsxResponse(await employeeTemplate(), "employee-import-template.xlsx");
}

/** Preview (dryRun=1) or import employees from an uploaded .xlsx/.csv. */
export async function POST(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  const auth = await resolvePoster(companyId, "canPost");
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
  return NextResponse.json(await importEmployees(companyId, rows, form?.get("dryRun") === "1"));
}
