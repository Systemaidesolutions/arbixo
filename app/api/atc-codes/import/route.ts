import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { parseImportFile, pick, toAmount } from "@/lib/transactionImportParse";
import type { IncomePaymentType } from "@prisma/client";

// Bulk-load the BIR ATC catalogue from .csv / .xlsx (admin-only). Upserts by
// code: new codes are created, existing ones updated (description/rate/type/
// active). Columns: Code, Description, Rate Percent, Income Payment Type, Active.
function parseType(s: string): IncomePaymentType {
  const t = s.trim().toLowerCase();
  if (t.startsWith("good")) return "GOODS";
  if (t.startsWith("serv")) return "SERVICES";
  return "BOTH";
}
const isNo = (s: string) => ["no", "n", "false", "0", "inactive"].includes(s.trim().toLowerCase());

export async function POST(request: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > 5_000_000) return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 400 });

  let rows;
  try {
    rows = await parseImportFile(Buffer.from(await file.arrayBuffer()), file.name);
  } catch {
    return NextResponse.json({ error: "Could not read the file. Make sure it's a valid .csv or .xlsx." }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });

  const issues: string[] = [];
  let created = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;
    const code = pick(row, ["Code", "ATC Code", "ATC"]).trim().toUpperCase();
    const description = pick(row, ["Description", "Nature of Income Payment", "Nature"]).trim();
    const rate = toAmount(pick(row, ["Rate Percent", "Rate", "Rate %", "Tax Rate"]));
    if (!code) { if (description || rate != null) issues.push(`Row ${rowNo}: missing Code.`); continue; }
    if (rate == null) { issues.push(`Row ${rowNo} (${code}): missing/invalid Rate Percent.`); continue; }
    if (rate < 0 || rate > 100) { issues.push(`Row ${rowNo} (${code}): rate ${rate} is out of range.`); continue; }

    const data = {
      description: description || code,
      ratePercent: rate,
      incomePaymentType: parseType(pick(row, ["Income Payment Type", "Type", "Nature Type"])),
      isActive: !isNo(pick(row, ["Active", "Is Active"])),
    };
    const existing = await prisma.atcCode.findUnique({ where: { code }, select: { id: true } });
    if (existing) { await prisma.atcCode.update({ where: { code }, data }); updated++; }
    else { await prisma.atcCode.create({ data: { code, ...data } }); created++; }
  }

  return NextResponse.json({ created, updated, issues });
}
