import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { parseImportFile, pick, toAmount, toDateStr, type SheetRow } from "@/lib/transactionImportParse";

type Issue = { row: number | null; ref: string; message: string };
type PreparedImport = {
  rowNo: number;
  orNo: string;
  sellerName: string;
  countryOrigin: string;
  importDate: Date;
  assessReleaseDate: Date;
  paymentDate: Date;
  dutiableValue: number;
  charges: number;
  isVatExempt: boolean;
  vatAmount: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isYes = (s: string) => ["yes", "y", "true", "1", "exempt"].includes(s.trim().toLowerCase());

async function buildDocs(rows: SheetRow[]): Promise<{ docs: PreparedImport[]; issues: Issue[] }> {
  const docs: PreparedImport[] = [];
  const issues: Issue[] = [];
  rows.forEach((row, i) => {
    const rowNo = i + 2;
    const orNo = pick(row, ["OR No", "OR", "Official Receipt No", "Ref"]).trim();
    const sellerName = pick(row, ["Seller Name", "Seller", "Foreign Seller"]).trim();
    const countryOrigin = pick(row, ["Country of Origin", "Country Origin", "Country"]).trim();
    // Skip fully-blank rows.
    if (!orNo && !sellerName && !countryOrigin && !pick(row, ["Dutiable Value"])) return;

    let bad = false;
    const req = (v: string, label: string) => { if (!v) { issues.push({ row: rowNo, ref: orNo, message: `Missing ${label}.` }); bad = true; } return v; };
    req(orNo, "OR No");
    req(sellerName, "Seller Name");
    req(countryOrigin, "Country of Origin");

    const importDate = toDateStr(pick(row, ["Import Date", "Date of Importation"]));
    const assessDate = toDateStr(pick(row, ["Assessment Release Date", "Assessment/Release Date", "Release Date"]));
    const paymentDate = toDateStr(pick(row, ["Payment Date", "Date of Payment"]));
    if (!importDate) { issues.push({ row: rowNo, ref: orNo, message: "Missing or invalid Import Date." }); bad = true; }
    if (!assessDate) { issues.push({ row: rowNo, ref: orNo, message: "Missing or invalid Assessment/Release Date." }); bad = true; }
    if (!paymentDate) { issues.push({ row: rowNo, ref: orNo, message: "Missing or invalid Payment Date." }); bad = true; }

    const dutiable = toAmount(pick(row, ["Dutiable Value", "Dutiable"]));
    const charges = toAmount(pick(row, ["Charges", "Other Charges"])) ?? 0;
    if (dutiable == null) { issues.push({ row: rowNo, ref: orNo, message: "Missing or invalid Dutiable Value." }); bad = true; }

    if (bad || dutiable == null || !importDate || !assessDate || !paymentDate) return;

    const isVatExempt = isYes(pick(row, ["VAT Exempt", "Is VAT Exempt", "Exempt"]));
    const dv = round2(dutiable);
    const ch = round2(charges);
    docs.push({
      rowNo, orNo, sellerName, countryOrigin,
      importDate: new Date(`${importDate}T00:00:00`),
      assessReleaseDate: new Date(`${assessDate}T00:00:00`),
      paymentDate: new Date(`${paymentDate}T00:00:00`),
      dutiableValue: dv, charges: ch, isVatExempt,
      vatAmount: isVatExempt ? 0 : round2((dv + ch) * 0.12),
    });
  });
  return { docs, issues };
}

export async function handleImportationImport(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user?.companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  const companyId = user.companyId;
  const auth = await resolvePoster(companyId, "canPost");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const dryRun = form?.get("dryRun") === "1";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > 5_000_000) return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 400 });

  let rows;
  try {
    rows = await parseImportFile(Buffer.from(await file.arrayBuffer()), file.name);
  } catch {
    return NextResponse.json({ error: "Could not read the file. Make sure it's a valid .csv or .xlsx." }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });

  const { docs, issues } = await buildDocs(rows);

  if (dryRun) {
    const preview = docs.map((d) => ({
      ref: `${d.orNo} (row ${d.rowNo})`, date: d.importDate.toISOString().slice(0, 10),
      info: d.sellerName, detail: `${d.countryOrigin}${d.isVatExempt ? " · VAT-exempt" : ""}`,
      amount: d.dutiableValue + d.charges + d.vatAmount,
    }));
    return NextResponse.json({ preview, issues, canImport: docs.length > 0 });
  }

  const results: { ref: string; ok: boolean; error?: string }[] = [];
  let posted = 0;
  for (const d of docs) {
    try {
      await prisma.importation.create({
        data: {
          companyId, assessReleaseDate: d.assessReleaseDate, sellerName: d.sellerName, importDate: d.importDate,
          countryOrigin: d.countryOrigin, dutiableValue: d.dutiableValue, charges: d.charges,
          isVatExempt: d.isVatExempt, vatAmount: d.vatAmount, orNo: d.orNo, paymentDate: d.paymentDate,
          createdById: auth.user.id,
        },
      });
      posted++;
      results.push({ ref: `${d.orNo} (row ${d.rowNo})`, ok: true });
    } catch {
      results.push({ ref: `${d.orNo} (row ${d.rowNo})`, ok: false, error: "Could not save this importation." });
    }
  }
  if (posted > 0) await logAudit({ companyId, username: auth.user.email, action: `Imported ${posted} importation(s)`, ipAddress: getClientIp(request) });
  return NextResponse.json({ results, posted, failed: results.length - posted, issues });
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function importationTemplate() {
  const headers = ["OR No", "Import Date", "Assessment Release Date", "Payment Date", "Seller Name", "Country of Origin", "Dutiable Value", "Charges", "VAT Exempt"];
  const example = [["OR-2026-001", "2026-07-09", "2026-07-08", "2026-07-09", "Foreign Supplier Ltd.", "China", "100000", "5000", "No"]];
  const csv = "﻿" + [headers, ...example].map((r) => r.map(esc).join(",")).join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="importations-import-template.csv"' } });
}
