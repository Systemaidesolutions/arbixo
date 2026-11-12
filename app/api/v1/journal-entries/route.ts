import { NextRequest, NextResponse } from "next/server";
import { authenticateExternalApi, externalApiError } from "@/lib/externalApiAuth";
import { buildDocs } from "@/lib/generalJournalImport";
import { normHeader, type SheetRow } from "@/lib/transactionImportParse";
import { postDocument, DuplicateDocumentError, UnbalancedEntryError, type LedgerLineInput } from "@/lib/ledgerPosting";
import { counterpartyFields } from "@/lib/vatLineExpansion";
import { logAudit, getClientIp } from "@/lib/audit";

// External integration API — lets a partner's own system post a batch of
// General Journal entries (e.g. one total per GL account per day) without a
// logged-in session. Authenticated via API key (lib/externalApiAuth.ts), not
// a session cookie — see middleware.ts's PUBLIC_PREFIXES for /api/v1.
//
// Reuses buildDocs() from the CSV/XLSX General Journal import unchanged, so
// a batch submitted here is validated and matched (account codes, branch
// codes, party names, debit/credit balance, duplicate JV No.) exactly the
// same way a file uploaded on-screen would be. See /developers for the
// documented request/response shape.

type EntryLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
  partyType?: string;
  partyName?: string;
};
type EntryInput = {
  documentNo: string;
  date: string;
  branchCode?: string;
  particulars?: string;
  lines: EntryLineInput[];
};

function row(fields: Record<string, string | number | undefined>): SheetRow {
  const out: SheetRow = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== "") out[normHeader(k)] = String(v);
  }
  return out;
}

function entriesToRows(entries: EntryInput[]): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const entry of entries) {
    entry.lines?.forEach((line, i) => {
      rows.push(
        row({
          // Header-level fields only on the batch's first line — buildDocs
          // groups by "JV No" and reads these from the group's first row,
          // same convention the CSV template uses.
          "JV No": entry.documentNo,
          Date: i === 0 ? entry.date : undefined,
          "Branch Code": i === 0 ? entry.branchCode : undefined,
          Particulars: i === 0 ? entry.particulars : undefined,
          "Account Code": line.accountCode,
          Debit: line.debit,
          Credit: line.credit,
          "Line Description": line.description,
          "Party Type": line.partyType,
          "Party Name": line.partyName,
        })
      );
    });
  }
  return rows;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateExternalApi(request);
  if (!auth.ok) return externalApiError(auth);

  const body = (await request.json().catch(() => null)) as { entries?: EntryInput[] } | null;
  if (!body?.entries?.length) {
    return NextResponse.json({ error: "Request body must be { entries: [...] } with at least one entry." }, { status: 400 });
  }
  for (const [i, entry] of body.entries.entries()) {
    if (!entry.documentNo) return NextResponse.json({ error: `entries[${i}] is missing documentNo.` }, { status: 400 });
    if (!entry.lines?.length) return NextResponse.json({ error: `entries[${i}] ("${entry.documentNo}") has no lines.` }, { status: 400 });
  }

  const rows = entriesToRows(body.entries);
  const { docs, issues } = await buildDocs(auth.companyId, rows);

  const results: { documentNo: string; status: "posted" | "failed"; error?: string }[] = [];
  let posted = 0;
  for (const d of docs) {
    try {
      const lines: LedgerLineInput[] = d.lines.map((l) => ({
        accountId: l.accountId,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
        description: l.description ?? d.particulars ?? null,
        ...counterpartyFields(l.counterpartyType, l.counterpartyId),
      }));
      await postDocument({
        companyId: auth.companyId,
        locationId: d.locationId,
        journalType: "GENERAL_JOURNAL",
        documentType: "JOURNAL",
        documentNo: d.documentNo,
        postingDate: d.postingDate,
        lines,
        createdById: null,
      });
      posted++;
      results.push({ documentNo: d.documentNo, status: "posted" });
    } catch (err) {
      const known = err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError;
      results.push({
        documentNo: d.documentNo,
        status: "failed",
        error: known ? (err as Error).message : "Unexpected error posting this entry.",
      });
    }
  }

  // Documents buildDocs rejected outright (bad account code, unbalanced,
  // missing fields, …) never became a `doc` at all — surface them as failed
  // results too, not just in `issues`, so a caller checking `results` alone
  // still sees every documentNo it sent accounted for.
  const attemptedRefs = new Set(results.map((r) => r.documentNo));
  for (const entry of body.entries) {
    if (attemptedRefs.has(entry.documentNo)) continue;
    const reason = issues.find((i) => i.ref === entry.documentNo)?.message ?? "Could not be validated.";
    results.push({ documentNo: entry.documentNo, status: "failed", error: reason });
  }

  if (posted > 0) {
    await logAudit({
      companyId: auth.companyId,
      username: `api:${auth.credentialId}`,
      action: `Posted ${posted} General Journal entry(ies) via integration API`,
      ipAddress: getClientIp(request),
    });
  }

  return NextResponse.json({ results, posted, failed: results.length - posted }, { status: 200 });
}
