import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { parseImportFile, pick, toAmount, toDateStr, type SheetRow } from "@/lib/transactionImportParse";
import { postDocument, DuplicateDocumentError, UnbalancedEntryError, type LedgerLineInput } from "@/lib/ledgerPosting";
import { counterpartyFields } from "@/lib/vatLineExpansion";
import type { CounterpartyType } from "@prisma/client";

type Issue = { row: number | null; ref: string; message: string };
type PreparedLine = { accountId: string; debitAmount: number; creditAmount: number; description: string | null; counterpartyType: CounterpartyType | null; counterpartyId: string | null };
type PreparedDoc = { documentNo: string; postingDate: Date; locationId: string | null; particulars: string | null; lines: PreparedLine[]; debit: number; credit: number };

const ci = (s: string) => s.trim().toLowerCase();
function parsePartyType(s: string): CounterpartyType | null {
  const t = ci(s);
  if (t.startsWith("vend") || t.startsWith("supp")) return "VENDOR";
  if (t.startsWith("emp")) return "EMPLOYEE";
  if (t.startsWith("cont")) return "CONTACT";
  if (t.startsWith("cust")) return "CUSTOMER";
  return null;
}
type PartyRow = { id: string; code: string; registeredName?: string | null; lastName?: string | null; firstName?: string | null };
function partyCandidates(p: PartyRow): string[] {
  const out = [p.code];
  if (p.registeredName) out.push(p.registeredName);
  if (p.lastName || p.firstName) {
    out.push(`${p.lastName ?? ""}, ${p.firstName ?? ""}`.replace(/^, |, $/g, "").trim());
    out.push(`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim());
  }
  return out.filter(Boolean);
}

async function buildDocs(companyId: string, rows: SheetRow[]): Promise<{ docs: PreparedDoc[]; issues: Issue[] }> {
  const [accounts, vendors, customers, employees, contacts, locations] = await Promise.all([
    prisma.account.findMany({ where: { companyId, isActive: true, accountType: "POSTING" }, select: { id: true, code: true } }),
    prisma.vendor.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, registeredName: true, lastName: true, firstName: true } }),
    prisma.customer.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, registeredName: true, lastName: true, firstName: true } }),
    prisma.employee.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, lastName: true, firstName: true } }),
    prisma.contact.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, registeredName: true, lastName: true, firstName: true } }),
    prisma.location.findMany({ where: { companyId }, select: { id: true, name: true, branchCode: true } }),
  ]);
  const acctByCode = new Map(accounts.map((a) => [ci(a.code), a]));
  const partyLists: Record<CounterpartyType, PartyRow[]> = { VENDOR: vendors, CUSTOMER: customers, EMPLOYEE: employees, CONTACT: contacts };
  function findParty(type: CounterpartyType, text: string) {
    const needle = ci(text);
    for (const p of partyLists[type]) if (partyCandidates(p).some((c) => ci(c) === needle)) return p.id;
    return null;
  }
  function findBranch(text: string) {
    const needle = ci(text);
    const digits = text.replace(/\D/g, "");
    for (const l of locations) {
      const code = (l.branchCode ?? "").replace(/\D/g, "");
      if (ci(l.name) === needle || (digits && code && code.padStart(5, "0") === digits.padStart(5, "0"))) return l.id;
    }
    return null;
  }

  const refKeys = ["JV No", "Document No", "Doc No", "Ref No", "Ref"];
  const groups = new Map<string, { rowNo: number; row: SheetRow }[]>();
  const order: string[] = [];
  rows.forEach((row, i) => {
    const ref = pick(row, refKeys).trim();
    const key = ref || `__blank_${i}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key)!.push({ rowNo: i + 2, row });
  });

  const docs: PreparedDoc[] = [];
  const issues: Issue[] = [];
  for (const key of order) {
    const groupRows = groups.get(key)!;
    const first = groupRows[0];
    const ref = pick(first.row, refKeys).trim();
    if (!ref) { issues.push({ row: first.rowNo, ref: "", message: "Missing JV No." }); continue; }
    const dateStr = toDateStr(pick(first.row, ["Date", "Posting Date"]));
    if (!dateStr) issues.push({ row: first.rowNo, ref, message: "Missing or invalid Date." });

    const branchText = pick(first.row, ["Branch Code", "Branch"]).trim();
    let locationId: string | null = null;
    if (branchText) {
      const b = findBranch(branchText);
      if (!b) issues.push({ row: first.rowNo, ref, message: `Branch "${branchText}" not found.` });
      else locationId = b;
    }
    const particulars = pick(first.row, ["Particulars", "Description", "Memo"]).trim() || null;

    const lines: PreparedLine[] = [];
    for (const { rowNo, row } of groupRows) {
      const acctCode = pick(row, ["Account Code", "Account", "GL Account"]).trim();
      const debit = toAmount(pick(row, ["Debit", "Debit Amount"])) ?? 0;
      const credit = toAmount(pick(row, ["Credit", "Credit Amount"])) ?? 0;
      if (!acctCode && !debit && !credit) continue;
      const acct = acctCode ? acctByCode.get(ci(acctCode)) : undefined;
      if (!acctCode) { issues.push({ row: rowNo, ref, message: "Line missing Account code." }); continue; }
      if (!acct) { issues.push({ row: rowNo, ref, message: `Account "${acctCode}" not found.` }); continue; }
      if (debit > 0 && credit > 0) { issues.push({ row: rowNo, ref, message: "A line can't have both a debit and a credit." }); continue; }
      if (debit <= 0 && credit <= 0) { issues.push({ row: rowNo, ref, message: `Line for "${acctCode}" needs a debit or credit amount.` }); continue; }

      const ptype = parsePartyType(pick(row, ["Party Type"]));
      const ptext = pick(row, ["Party Name", "Party", "Name"]).trim();
      let counterpartyType: CounterpartyType | null = null;
      let counterpartyId: string | null = null;
      if (ptext && ptype) {
        const id = findParty(ptype, ptext);
        if (!id) issues.push({ row: rowNo, ref, message: `${ptype.toLowerCase()} "${ptext}" not found.` });
        else { counterpartyType = ptype; counterpartyId = id; }
      }
      lines.push({ accountId: acct.id, debitAmount: debit, creditAmount: credit, description: pick(row, ["Line Description", "Description"]).trim() || null, counterpartyType, counterpartyId });
    }

    if (lines.length < 2) { issues.push({ row: first.rowNo, ref, message: "A journal entry needs at least two valid lines." }); continue; }
    const debit = Math.round(lines.reduce((s, l) => s + l.debitAmount, 0) * 100) / 100;
    const credit = Math.round(lines.reduce((s, l) => s + l.creditAmount, 0) * 100) / 100;
    if (debit !== credit) { issues.push({ row: first.rowNo, ref, message: `Debits (${debit}) and credits (${credit}) don't balance.` }); continue; }
    if (!dateStr) continue;

    docs.push({ documentNo: ref, postingDate: new Date(`${dateStr}T00:00:00`), locationId, particulars, lines, debit, credit });
  }
  return { docs, issues };
}

export async function handleGeneralJournalImport(request: NextRequest) {
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

  const { docs, issues } = await buildDocs(companyId, rows);

  if (dryRun) {
    const preview = docs.map((d) => ({ ref: d.documentNo, date: d.postingDate.toISOString().slice(0, 10), info: d.particulars, detail: `${d.lines.length} line(s)`, amount: d.debit }));
    return NextResponse.json({ preview, issues, canImport: docs.length > 0 });
  }

  const results: { ref: string; ok: boolean; error?: string }[] = [];
  let posted = 0;
  for (const d of docs) {
    try {
      const glLines: LedgerLineInput[] = d.lines.map((l) => ({
        accountId: l.accountId, debitAmount: l.debitAmount, creditAmount: l.creditAmount,
        description: l.description ?? d.particulars ?? null, ...counterpartyFields(l.counterpartyType, l.counterpartyId),
      }));
      await postDocument({
        companyId, locationId: d.locationId, journalType: "GENERAL_JOURNAL", documentType: "JOURNAL",
        documentNo: d.documentNo, postingDate: d.postingDate, lines: glLines,
        createdById: auth.user.id, isApproved: auth.capability.canApprove,
      });
      posted++;
      results.push({ ref: d.documentNo, ok: true });
    } catch (err) {
      const known = err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError;
      results.push({ ref: d.documentNo, ok: false, error: known ? (err as Error).message : "Unexpected error posting this entry." });
    }
  }
  if (posted > 0) await logAudit({ companyId, username: auth.user.email, action: `Imported ${posted} General Journal entry(ies)`, ipAddress: getClientIp(request) });
  return NextResponse.json({ results, posted, failed: results.length - posted, issues });
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function generalJournalTemplate() {
  const headers = ["JV No", "Date", "Branch Code", "Particulars", "Account Code", "Debit", "Credit", "Line Description", "Party Type", "Party Name"];
  const example = [
    ["JV-2026-001", "2026-07-09", "00000", "Depreciation for July", "65100", "5000", "", "Depreciation expense", "", ""],
    ["JV-2026-001", "", "", "", "15200", "", "5000", "Accumulated depreciation", "", ""],
  ];
  const csv = "﻿" + [headers, ...example].map((r) => r.map(esc).join(",")).join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="general-journal-import-template.csv"' } });
}
