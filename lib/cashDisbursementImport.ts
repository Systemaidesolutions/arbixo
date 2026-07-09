import { prisma } from "@/lib/prisma";
import { pick, toAmount, toDateStr, toBoolGross, type SheetRow } from "@/lib/transactionImportParse";
import type { CounterpartyType, VatType, TaxSource } from "@prisma/client";

export type PreparedLine = {
  accountId: string;
  accountLabel: string;
  amount: number;
  vatType: VatType;
  amountIsGross: boolean;
  atcCodeId: string | null;
  atcLabel: string | null;
  taxSource: TaxSource;
};

export type PreparedDoc = {
  cvNo: string;
  postingDate: string;
  checkNo: string | null;
  locationId: string | null;
  branchLabel: string | null;
  counterpartyType: CounterpartyType | null;
  counterpartyId: string | null;
  payeeLabel: string | null;
  cashAccountId: string;
  cashAccountLabel: string;
  particulars: string | null;
  lines: PreparedLine[];
};

export type ImportIssue = { row: number | null; cvNo: string; message: string };
export type BuildResult = { docs: PreparedDoc[]; issues: ImportIssue[] };

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

/**
 * Resolves parsed sheet rows into ready-to-post Cash Disbursement documents for
 * a company. Rows are grouped by CV no.; header fields come from the first row
 * of each group. Returns the prepared docs plus a list of blocking issues
 * (unknown account/payee/cash account, bad amount, etc.).
 */
export async function buildCashDisbursementDocs(companyId: string, rows: SheetRow[]): Promise<BuildResult> {
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
  const partyLists: Record<CounterpartyType, PartyRow[]> = {
    VENDOR: vendors, CUSTOMER: customers, EMPLOYEE: employees, CONTACT: contacts,
  };

  function findParty(type: CounterpartyType, text: string): { id: string; label: string } | null {
    const needle = ci(text);
    for (const p of partyLists[type]) {
      if (partyCandidates(p).some((c) => ci(c) === needle)) {
        return { id: p.id, label: partyCandidates(p)[1] ?? p.code };
      }
    }
    return null;
  }

  function findBranch(text: string): { id: string; label: string } | null {
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

  // Group rows by CV no., remembering the original row number (1-based, +1 for header).
  const groups = new Map<string, { rowNo: number; row: SheetRow }[]>();
  const order: string[] = [];
  rows.forEach((row, i) => {
    const cv = pick(row, ["CV No", "CV", "Voucher No", "Document No", "Doc No"]).trim();
    const key = cv || `__blank_${i}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key)!.push({ rowNo: i + 2, row });
  });

  const docs: PreparedDoc[] = [];
  const issues: ImportIssue[] = [];

  for (const key of order) {
    const groupRows = groups.get(key)!;
    const first = groupRows[0];
    const cvNo = pick(first.row, ["CV No", "CV", "Voucher No", "Document No", "Doc No"]).trim();
    if (!cvNo) {
      issues.push({ row: first.rowNo, cvNo: "", message: "Missing CV no." });
      continue;
    }

    // ---- header (from the first row of the group) ----
    const dateStr = toDateStr(pick(first.row, ["Date", "Posting Date"]));
    if (!dateStr) issues.push({ row: first.rowNo, cvNo, message: "Missing or invalid Date." });

    const cashCode = pick(first.row, ["Cash Account Code", "Cash Account", "Bank Account"]).trim();
    const cash = cashCode ? acctByCode.get(ci(cashCode)) : undefined;
    if (!cashCode) issues.push({ row: first.rowNo, cvNo, message: "Missing Cash Account code." });
    else if (!cash) issues.push({ row: first.rowNo, cvNo, message: `Cash account "${cashCode}" not found.` });

    const payeeType = parsePayeeType(pick(first.row, ["Payee Type", "Party Type"]));
    const payeeText = pick(first.row, ["Payee Name", "Payee", "Payor Name", "Name"]).trim();
    let counterpartyType: CounterpartyType | null = null;
    let counterpartyId: string | null = null;
    let payeeLabel: string | null = null;
    if (payeeText) {
      if (!payeeType) {
        issues.push({ row: first.rowNo, cvNo, message: `Payee "${payeeText}" given but Payee Type is missing/unknown (Vendor/Employee/Contact/Customer).` });
      } else {
        const found = findParty(payeeType, payeeText);
        if (!found) issues.push({ row: first.rowNo, cvNo, message: `${payeeType.toLowerCase()} "${payeeText}" not found.` });
        else { counterpartyType = payeeType; counterpartyId = found.id; payeeLabel = found.label; }
      }
    }

    const branchText = pick(first.row, ["Branch Code", "Branch"]).trim();
    let locationId: string | null = null;
    let branchLabel: string | null = null;
    if (branchText) {
      const b = findBranch(branchText);
      if (!b) issues.push({ row: first.rowNo, cvNo, message: `Branch "${branchText}" not found.` });
      else { locationId = b.id; branchLabel = b.label; }
    }

    const particulars = pick(first.row, ["Particulars", "Description", "Memo", "Remarks"]).trim() || null;
    const checkNo = pick(first.row, ["Check No", "Cheque No"]).trim() || null;

    // ---- lines (every row in the group) ----
    const lines: PreparedLine[] = [];
    for (const { rowNo, row } of groupRows) {
      const acctCode = pick(row, ["Account Code", "Account", "Expense Account", "GL Account"]).trim();
      const amount = toAmount(pick(row, ["Amount", "Gross Amount"]));
      if (!acctCode && amount == null) continue; // blank line row — skip silently
      const acct = acctCode ? acctByCode.get(ci(acctCode)) : undefined;
      if (!acctCode) { issues.push({ row: rowNo, cvNo, message: "Line missing Account code." }); continue; }
      if (!acct) { issues.push({ row: rowNo, cvNo, message: `Account "${acctCode}" not found.` }); continue; }
      if (amount == null) { issues.push({ row: rowNo, cvNo, message: `Line for "${acctCode}" has an invalid Amount.` }); continue; }
      if (amount <= 0) { issues.push({ row: rowNo, cvNo, message: `Line for "${acctCode}" amount must be greater than zero.` }); continue; }

      const atcText = pick(row, ["ATC Code", "ATC", "Withholding ATC"]).trim();
      const atc = atcText ? atcByCode.get(ci(atcText)) : undefined;
      if (atcText && !atc) { issues.push({ row: rowNo, cvNo, message: `ATC code "${atcText}" not found.` }); continue; }

      lines.push({
        accountId: acct.id,
        accountLabel: `${acct.code} — ${acct.title}`,
        amount,
        vatType: parseVatType(pick(row, ["VAT Type", "VAT", "Tax Type"])),
        amountIsGross: toBoolGross(pick(row, ["Amount Is Gross", "Gross Or Net", "Gross/Net"])),
        atcCodeId: atc?.id ?? null,
        atcLabel: atc?.code ?? null,
        taxSource: parseTaxSource(pick(row, ["Nature", "Tax Source", "Purchase Type"])),
      });
    }

    if (lines.length === 0) {
      issues.push({ row: first.rowNo, cvNo, message: "Voucher has no valid lines." });
      continue;
    }
    if (!dateStr || !cash) continue; // header errors already recorded; can't build

    docs.push({
      cvNo, postingDate: dateStr, checkNo, locationId, branchLabel,
      counterpartyType, counterpartyId, payeeLabel,
      cashAccountId: cash.id, cashAccountLabel: `${cash.code} — ${cash.title}`,
      particulars, lines,
    });
  }

  return { docs, issues };
}
