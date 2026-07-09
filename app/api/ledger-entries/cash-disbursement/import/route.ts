import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord, resolvePoster } from "@/lib/currentUser";
import { parseImportFile } from "@/lib/transactionImportParse";
import { buildCashDisbursementDocs } from "@/lib/cashDisbursementImport";
import { postCashDisbursement, ZeroCashError } from "@/lib/cashDisbursementPosting";
import { MissingPostingAccountError } from "@/lib/vatLineExpansion";
import { DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import { logAudit, getClientIp } from "@/lib/audit";

// Import Cash Disbursement vouchers from an uploaded .csv / .xlsx file.
// dryRun=1 -> validate and return a preview; otherwise post each voucher and
// return per-voucher results.
export async function POST(request: NextRequest) {
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
    const buf = Buffer.from(await file.arrayBuffer());
    rows = await parseImportFile(buf, file.name);
  } catch {
    return NextResponse.json({ error: "Could not read the file. Make sure it's a valid .csv or .xlsx." }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });

  const { docs, issues } = await buildCashDisbursementDocs(companyId, rows);

  const preview = docs.map((d) => ({
    cvNo: d.cvNo,
    date: d.postingDate,
    payee: d.payeeLabel,
    branch: d.branchLabel,
    cashAccount: d.cashAccountLabel,
    lineCount: d.lines.length,
    amount: d.lines.reduce((s, l) => s + l.amount, 0),
  }));

  if (dryRun) {
    return NextResponse.json({ preview, issues, canImport: docs.length > 0 });
  }

  // Commit — post each prepared voucher independently so a bad row doesn't
  // block the good ones.
  const results: { cvNo: string; ok: boolean; error?: string }[] = [];
  let posted = 0;
  for (const d of docs) {
    try {
      await postCashDisbursement(
        companyId,
        {
          locationId: d.locationId,
          documentNo: d.cvNo,
          checkNo: d.checkNo,
          postingDate: new Date(`${d.postingDate}T00:00:00`),
          counterpartyType: d.counterpartyType,
          counterpartyId: d.counterpartyId,
          cashAccountId: d.cashAccountId,
          particulars: d.particulars,
          lines: d.lines.map((l) => ({
            accountId: l.accountId,
            amount: l.amount,
            vatType: l.vatType,
            amountIsGross: l.amountIsGross,
            atcCodeId: l.atcCodeId,
            taxSource: l.taxSource,
          })),
        },
        auth.user.id,
        auth.capability.canApprove
      );
      posted++;
      results.push({ cvNo: d.cvNo, ok: true });
    } catch (err) {
      const known =
        err instanceof MissingPostingAccountError ||
        err instanceof ZeroCashError ||
        err instanceof UnbalancedEntryError ||
        err instanceof DuplicateDocumentError;
      results.push({ cvNo: d.cvNo, ok: false, error: known ? (err as Error).message : "Unexpected error posting this voucher." });
    }
  }

  if (posted > 0) {
    await logAudit({
      companyId,
      username: auth.user.email,
      action: `Imported ${posted} Cash Disbursement voucher(s)`,
      ipAddress: getClientIp(request),
    });
  }
  return NextResponse.json({ results, posted, failed: results.length - posted, issues });
}
