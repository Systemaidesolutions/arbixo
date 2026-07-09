import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, resolvePoster } from "@/lib/currentUser";
import { logAudit, getClientIp } from "@/lib/audit";
import { parseImportFile, pick, toAmount, toDateStr, toBoolGross, type SheetRow } from "@/lib/transactionImportParse";
import { VAT_JOURNALS, postVatJournal, ZeroBalanceError, type VatJournalKey, type VatJournalDoc } from "@/lib/vatJournals";
import { MissingPostingAccountError } from "@/lib/vatLineExpansion";
import { DuplicateDocumentError, UnbalancedEntryError } from "@/lib/ledgerPosting";
import type { CounterpartyType, VatType, TaxSource } from "@prisma/client";

export type ImportIssue = { row: number | null; ref: string; message: string };
export type PreparedDoc = VatJournalDoc & { payeeLabel: string | null; balancingLabel: string; total: number };

const ci = (s: string) => s.trim().toLowerCase();

function parseVatType(s: string): VatType {
  const t = ci(s).replace(/[^a-z0-9]/g, "");
  if (["vat", "vat12", "vatable", "12", "1212", "vat12percent"].includes(t)) return "VAT_12";
  if (t.startsWith("zero")) return "ZERO_RATED";
  if (t.includes("exempt")) return "VAT_EXEMPT";
  return "NON_VAT";
}
function parseTaxSource(s: string): TaxSource {
  const t = ci(s).replace(/[^a-z]/g, "");
  if (t.startsWith("service")) return "SERVICE";
  if (t.startsWith("capital")) return "CAPITAL_GOODS";
  return "GOODS";
}
function parsePayeeType(s: string): CounterpartyType | null {
  const t = ci(s);
  if (!t) return null;
  if (t.startsWith("vend") || t.startsWith("supp")) return "VENDOR";
  if (t.startsWith("emp")) return "EMPLOYEE";
  if (t.startsWith("cont")) return "CONTACT";
  if (t.startsWith("cust")) return "CUSTOMER";
  return null;
}
function isYes(s: string): boolean {
  return ["yes", "y", "true", "1", "return", "cm"].includes(ci(s));
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

/** Resolve parsed rows into ready-to-post VAT-journal documents for a company. */
export async function buildVatJournalDocs(
  companyId: string,
  key: VatJournalKey,
  rows: SheetRow[]
): Promise<{ docs: PreparedDoc[]; issues: ImportIssue[] }> {
  const cfg = VAT_JOURNALS[key];
  const [accounts, atcCodes, vendors, customers, employees, contacts, locations] = await Promise.all([
    prisma.account.findMany({ where: { companyId, isActive: true, accountType: "POSTING" }, select: { id: true, code: true, title: true } }),
    prisma.atcCode.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
    prisma.vendor.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, registeredName: true, lastName: true, firstName: true } }),
    prisma.customer.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, registeredName: true, lastName: true, firstName: true } }),
    prisma.employee.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, lastName: true, firstName: true } }),
    prisma.contact.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true, registeredName: true, lastName: true, firstName: true } }),
    prisma.location.findMany({ where: { companyId }, select: { id: true, name: true, branchCode: true } }),
  ]);

  const acctByCode = new Map(accounts.map((a) => [ci(a.code), a]));
  const atcByCode = new Map(atcCodes.map((a) => [ci(a.code), a]));
  const partyLists: Record<CounterpartyType, PartyRow[]> = { VENDOR: vendors, CUSTOMER: customers, EMPLOYEE: employees, CONTACT: contacts };

  function findParty(type: CounterpartyType, text: string) {
    const needle = ci(text);
    for (const p of partyLists[type]) {
      if (partyCandidates(p).some((c) => ci(c) === needle)) return { id: p.id, label: partyCandidates(p)[1] ?? p.code };
    }
    return null;
  }
  function findBranch(text: string) {
    const needle = ci(text);
    const digits = text.replace(/\D/g, "");
    for (const l of locations) {
      const code = (l.branchCode ?? "").replace(/\D/g, "");
      if (ci(l.name) === needle || (digits && code && code.padStart(5, "0") === digits.padStart(5, "0"))) {
        return { id: l.id, label: `${code || "00000"} — ${l.name}` };
      }
    }
    return null;
  }

  const refKeys = [cfg.refLabel, "Document No", "Doc No", "Ref No", "Ref"];
  const balKeys = [cfg.balancingHeader, cfg.balancingLabel];

  // Group rows by document no.
  const groups = new Map<string, { rowNo: number; row: SheetRow }[]>();
  const order: string[] = [];
  rows.forEach((row, i) => {
    const ref = pick(row, refKeys).trim();
    const groupKey = ref || `__blank_${i}`;
    if (!groups.has(groupKey)) { groups.set(groupKey, []); order.push(groupKey); }
    groups.get(groupKey)!.push({ rowNo: i + 2, row });
  });

  const docs: PreparedDoc[] = [];
  const issues: ImportIssue[] = [];

  for (const groupKey of order) {
    const groupRows = groups.get(groupKey)!;
    const first = groupRows[0];
    const ref = pick(first.row, refKeys).trim();
    if (!ref) { issues.push({ row: first.rowNo, ref: "", message: `Missing ${cfg.refLabel}.` }); continue; }

    const dateStr = toDateStr(pick(first.row, ["Date", "Posting Date"]));
    if (!dateStr) issues.push({ row: first.rowNo, ref, message: "Missing or invalid Date." });

    const balCode = pick(first.row, balKeys).trim();
    const bal = balCode ? acctByCode.get(ci(balCode)) : undefined;
    if (!balCode) issues.push({ row: first.rowNo, ref, message: `Missing ${cfg.balancingLabel} code.` });
    else if (!bal) issues.push({ row: first.rowNo, ref, message: `${cfg.balancingLabel} "${balCode}" not found.` });

    const payeeType = parsePayeeType(pick(first.row, ["Payee Type", "Party Type"])) ?? cfg.defaultParty;
    const payeeText = pick(first.row, ["Payee Name", "Payee", "Customer Name", "Vendor Name", "Name"]).trim();
    let counterpartyType: CounterpartyType | null = null;
    let counterpartyId: string | null = null;
    let payeeLabel: string | null = null;
    if (payeeText) {
      if (!payeeType) issues.push({ row: first.rowNo, ref, message: `Party "${payeeText}" given but Party Type is missing/unknown.` });
      else {
        const found = findParty(payeeType, payeeText);
        if (!found) issues.push({ row: first.rowNo, ref, message: `${payeeType.toLowerCase()} "${payeeText}" not found.` });
        else { counterpartyType = payeeType; counterpartyId = found.id; payeeLabel = found.label; }
      }
    }

    const branchText = pick(first.row, ["Branch Code", "Branch"]).trim();
    let locationId: string | null = null;
    if (branchText) {
      const b = findBranch(branchText);
      if (!b) issues.push({ row: first.rowNo, ref, message: `Branch "${branchText}" not found.` });
      else locationId = b.id;
    }

    const particulars = pick(first.row, ["Particulars", "Description", "Memo", "Remarks"]).trim() || null;
    const checkNo = cfg.hasCheck ? pick(first.row, ["Check No", "Cheque No"]).trim() || null : null;
    const isReturn = cfg.hasReturn ? isYes(pick(first.row, ["Is Return", "Return", "Credit Memo"])) : false;

    const lines = [];
    for (const { rowNo, row } of groupRows) {
      const acctCode = pick(row, ["Account Code", "Account", "Income Account", "Expense Account", "GL Account"]).trim();
      const amount = toAmount(pick(row, ["Amount", "Gross Amount"]));
      if (!acctCode && amount == null) continue;
      const acct = acctCode ? acctByCode.get(ci(acctCode)) : undefined;
      if (!acctCode) { issues.push({ row: rowNo, ref, message: "Line missing Account code." }); continue; }
      if (!acct) { issues.push({ row: rowNo, ref, message: `Account "${acctCode}" not found.` }); continue; }
      if (amount == null) { issues.push({ row: rowNo, ref, message: `Line for "${acctCode}" has an invalid Amount.` }); continue; }
      if (amount <= 0) { issues.push({ row: rowNo, ref, message: `Line for "${acctCode}" amount must be greater than zero.` }); continue; }
      const atcText = pick(row, ["ATC Code", "ATC", "Withholding ATC"]).trim();
      const atc = atcText ? atcByCode.get(ci(atcText)) : undefined;
      if (atcText && !atc) { issues.push({ row: rowNo, ref, message: `ATC code "${atcText}" not found.` }); continue; }
      lines.push({
        accountId: acct.id,
        amount,
        vatType: parseVatType(pick(row, ["VAT Type", "VAT", "Tax Type"])),
        amountIsGross: toBoolGross(pick(row, ["Amount Is Gross", "Gross Or Net", "Gross/Net"])),
        atcCodeId: atc?.id ?? null,
        taxSource: parseTaxSource(pick(row, ["Nature", "Tax Source", "Purchase Type"])),
      });
    }

    if (lines.length === 0) { issues.push({ row: first.rowNo, ref, message: "Document has no valid lines." }); continue; }
    if (!dateStr || !bal) continue;

    docs.push({
      documentNo: ref, postingDate: new Date(`${dateStr}T00:00:00`), checkNo, locationId,
      counterpartyType, counterpartyId, balancingAccountId: bal.id, particulars, isReturn, lines,
      payeeLabel, balancingLabel: `${bal.code} — ${bal.title}`, total: lines.reduce((s, l) => s + l.amount, 0),
    });
  }

  return { docs, issues };
}

/** Handles a VAT-journal import request (preview via dryRun=1, else post). */
export async function handleVatJournalImport(request: NextRequest, key: VatJournalKey) {
  const cfg = VAT_JOURNALS[key];
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

  const { docs, issues } = await buildVatJournalDocs(companyId, key, rows);

  if (dryRun) {
    const preview = docs.map((d) => ({
      ref: d.documentNo, date: d.postingDate.toISOString().slice(0, 10), info: d.payeeLabel,
      detail: `${d.lines.length} line(s) · ${d.balancingLabel}${d.isReturn ? " · RETURN" : ""}`, amount: d.total,
    }));
    return NextResponse.json({ preview, issues, canImport: docs.length > 0 });
  }

  const results: { ref: string; ok: boolean; error?: string }[] = [];
  let posted = 0;
  for (const d of docs) {
    try {
      await postVatJournal(companyId, key, d, auth.user.id, auth.capability.canApprove);
      posted++;
      results.push({ ref: d.documentNo, ok: true });
    } catch (err) {
      const known = err instanceof MissingPostingAccountError || err instanceof ZeroBalanceError || err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError;
      results.push({ ref: d.documentNo, ok: false, error: known ? (err as Error).message : "Unexpected error posting this document." });
    }
  }
  if (posted > 0) await logAudit({ companyId, username: auth.user.email, action: `Imported ${posted} ${cfg.title} document(s)`, ipAddress: getClientIp(request) });
  return NextResponse.json({ results, posted, failed: results.length - posted, issues });
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV template download for a VAT journal. */
export function vatJournalTemplate(key: VatJournalKey) {
  const cfg = VAT_JOURNALS[key];
  const headers = [
    cfg.refLabel, "Date",
    ...(cfg.hasCheck ? ["Check No"] : []),
    "Branch Code", "Payee Type", "Payee Name", cfg.balancingHeader, "Particulars",
    ...(cfg.hasReturn ? ["Is Return"] : []),
    "Account Code", "Nature", "VAT Type", "Amount", "Amount Is Gross", "ATC Code",
  ];
  const partyType = cfg.defaultParty ? cfg.defaultParty[0] + cfg.defaultParty.slice(1).toLowerCase() : "Vendor";
  const example = [
    cfg.key === "CASH_DISBURSEMENT" ? "CV-2026-001" : cfg.key === "CASH_RECEIPT" ? "OR-2026-001" : cfg.key === "SALES_ON_ACCOUNT" ? "INV-2026-001" : "PV-2026-001",
    "2026-07-09",
    ...(cfg.hasCheck ? ["001234"] : []),
    "00000", partyType, "ABC Trading Corp.", "10100", "Sample entry",
    ...(cfg.hasReturn ? ["No"] : []),
    "60150", "Goods", "VAT", "11200", "Gross", "",
  ];
  const csv = "﻿" + [headers, example].map((r) => r.map(esc).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${cfg.path}-import-template.csv"`,
    },
  });
}
