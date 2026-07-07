import { prisma } from "@/lib/prisma";
import { partyName, datText, datTin, amt, digitsOnly, mmddyyyy, H_TRAILER, type DatCompany } from "@/lib/slsp";

// BIR Quarterly Alphalist of Payees (QAP) — payees the company withheld
// expanded withholding tax (EWT) from (the withholding-agent side of purchases /
// cash disbursements). Reported per payee + ATC for the selected period
// (monthly, quarterly, or a date range).

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function num(d: unknown): number {
  return Number(d ?? 0);
}

/**
 * The branch-code portion of a TIN (the digits after the 9-digit base — 3 or 5
 * digits). Head office / a base-only TIN yields "000".
 */
export function tinBranchCode(tin: string | null | undefined): string {
  return digitsOnly(tin).slice(9) || "000";
}

/**
 * BIR Alphalist QAP upload filename, ready to submit:
 * <9-digit TIN><branch code><MM><YY>1601EQ.DAT — MM/YY are the covered
 * quarter's ending month + 2-digit year. e.g. TIN 123456789, head office
 * (000), Q1 2026 → 12345678900003261601EQ.DAT
 */
export function qapDatFilename(tin: string, branchCode: string, periodEnd: Date): string {
  const mm = String(periodEnd.getMonth() + 1).padStart(2, "0");
  const yy = String(periodEnd.getFullYear() % 100).padStart(2, "0");
  return `${datTin(tin)}${branchCode}${mm}${yy}1601EQ.DAT`;
}

export type QapRow = {
  id: string;
  tin: string;
  name: string;
  isIndividual: boolean;
  reg: string;
  last: string;
  first: string;
  middle: string;
  atcCode: string;
  atcDescription: string;
  ratePercent: number;
  income: number;
  tax: number;
};

export type Qap = {
  rows: QapRow[];
  totals: { income: number; tax: number };
};

type PayeeLike = {
  tin: string | null;
  taxClassification?: string | null;
  registeredName?: string | null;
  tradeName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
};

function payeeIdentity(p: PayeeLike, keyPrefix: string) {
  const isIndividual = Boolean(p.lastName || p.firstName || p.middleName);
  return {
    key: keyPrefix,
    tin: p.tin ?? "",
    isIndividual,
    reg: isIndividual ? "" : (p.registeredName ?? p.tradeName ?? ""),
    last: p.lastName ?? "",
    first: p.firstName ?? "",
    middle: p.middleName ?? "",
    name: partyName(p),
  };
}

export async function getAlphalistOfPayees(companyId: string, from: Date, to: Date, locationId?: string): Promise<Qap> {
  const [entries, atcCodes] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        ...(locationId ? { locationId } : {}),
        isCancelled: false,
        postingDate: { gte: from, lte: to },
        // The company is the withholding agent on money it pays out.
        journalType: { in: ["PURCHASE_ON_ACCOUNT", "CASH_DISBURSEMENT"] },
        atcCode: { not: null },
      },
      include: { vendor: true, contact: true, employee: true, customer: true },
    }),
    prisma.atcCode.findMany(),
  ]);
  const rateByCode = new Map(atcCodes.map((a) => [a.code, Number(a.ratePercent)]));

  const map = new Map<string, QapRow>();
  for (const e of entries) {
    let ident: ReturnType<typeof payeeIdentity> | null = null;
    if (e.vendorId && e.vendor) ident = payeeIdentity(e.vendor, `v:${e.vendorId}`);
    else if (e.contactId && e.contact) ident = payeeIdentity(e.contact, `c:${e.contactId}`);
    else if (e.employeeId && e.employee) ident = payeeIdentity(e.employee, `e:${e.employeeId}`);
    else if (e.customerId && e.customer) ident = payeeIdentity(e.customer, `cu:${e.customerId}`);
    if (!ident) continue;

    const atc = e.atcCode!;
    const key = `${ident.key}|${atc}`;
    let row = map.get(key);
    if (!row) {
      row = {
        id: key,
        tin: ident.tin,
        name: ident.name,
        isIndividual: ident.isIndividual,
        reg: ident.reg,
        last: ident.last,
        first: ident.first,
        middle: ident.middle,
        atcCode: atc,
        atcDescription: e.atcDescription ?? "",
        ratePercent: rateByCode.get(atc) ?? 0,
        income: 0,
        tax: 0,
      };
      map.set(key, row);
    }
    // Income base = main line net (its debit, or credit on a return); returns net out.
    const sign = e.isReturn ? -1 : 1;
    row.income += (num(e.debitAmount) + num(e.creditAmount)) * sign;
    row.tax += num(e.withholdingAmt) * sign;
  }

  const rows = [...map.values()].map((r) => ({ ...r, income: round2(r.income), tax: round2(r.tax) }));
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.atcCode.localeCompare(b.atcCode));

  const totals = rows.reduce(
    (t, r) => ({ income: round2(t.income + r.income), tax: round2(t.tax + r.tax) }),
    { income: 0, tax: 0 }
  );

  return { rows, totals };
}

/**
 * BIR Alphalist QAP file: one H (taxpayer + grand totals) record and one D
 * record per payee + ATC. Shared BIR sanitizing (commas stripped, 9-digit TIN).
 * Built to the shared H/D convention (no client QAP sample) — validate in BIR's
 * Alphalist module before filing.
 */
export function buildQapDat(co: DatCompany, qap: Qap, periodEnd: Date): string {
  const coTin = datTin(co.tin);
  const me = mmddyyyy(periodEnd);
  const t = qap.totals;
  const coIsPerson = Boolean(co.taxpayerLastName || co.taxpayerFirstName);
  const coReg = coIsPerson ? "" : datText(co.registeredName ?? co.tradeName ?? "");
  const coAddr1 = datText([co.businessAddress, co.barangay].filter(Boolean).join(" "));
  const coAddr2 = datText([co.city, co.province, co.zipCode].filter(Boolean).join(" "));

  const header = [
    "H", "Q", coTin, coReg,
    datText(co.taxpayerLastName), datText(co.taxpayerFirstName), datText(co.taxpayerMiddleName),
    datText(co.tradeName), coAddr1, coAddr2,
    amt(t.income), amt(t.tax),
    digitsOnly(co.rdoCode), me, H_TRAILER,
  ].join(",");

  const details = qap.rows.map((r, i) =>
    [
      "D", "Q", String(i + 1), datTin(r.tin),
      r.isIndividual ? "" : datText(r.reg),
      datText(r.last), datText(r.first), datText(r.middle),
      datText(r.atcCode), datText(r.atcDescription), amt(r.ratePercent),
      amt(r.income), amt(r.tax),
      coTin, me,
    ].join(",")
  );

  return [header, ...details].join("\r\n") + "\r\n";
}
