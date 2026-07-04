import { prisma } from "@/lib/prisma";
import { partyName, datText, datTin, amt, digitsOnly, mmddyyyy, H_TRAILER, type DatCompany } from "@/lib/slsp";

// BIR Quarterly Alphalist of Payees (QAP) — payees the company withheld
// expanded withholding tax (EWT) from, i.e. the withholding-agent side of
// purchases / cash disbursements. Income payment and tax withheld are split
// across the three months of the quarter.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function num(d: unknown): number {
  return Number(d ?? 0);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type QapRow = {
  id: string;
  tin: string;
  name: string;
  isIndividual: boolean;
  // Separate name components for the alphalist .DAT.
  reg: string;
  last: string;
  first: string;
  middle: string;
  atcCode: string;
  atcDescription: string;
  ratePercent: number;
  income: [number, number, number];
  tax: [number, number, number];
  incomeTotal: number;
  taxTotal: number;
};

export type Qap = {
  year: number;
  quarter: number;
  months: [string, string, string];
  rows: QapRow[];
  totals: {
    income: [number, number, number];
    tax: [number, number, number];
    incomeTotal: number;
    taxTotal: number;
  };
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

export async function getQuarterlyAlphalistOfPayees(
  companyId: string,
  year: number,
  quarter: number
): Promise<Qap> {
  const startMonth = (quarter - 1) * 3; // 0-based
  const from = new Date(`${year}-${String(startMonth + 1).padStart(2, "0")}-01T00:00:00`);
  const endMonth = startMonth + 2;
  const lastDay = new Date(year, endMonth + 1, 0).getDate();
  const to = new Date(`${year}-${String(endMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999`);

  const [entries, atcCodes] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
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
        income: [0, 0, 0],
        tax: [0, 0, 0],
        incomeTotal: 0,
        taxTotal: 0,
      };
      map.set(key, row);
    }

    // Income payment base = the main line's net (its debit, or credit on a
    // return); returns net out via sign.
    const sign = e.isReturn ? -1 : 1;
    const income = (num(e.debitAmount) + num(e.creditAmount)) * sign;
    const tax = num(e.withholdingAmt) * sign;
    const mIdx = Math.min(2, Math.max(0, e.postingDate.getMonth() - startMonth));
    row.income[mIdx] += income;
    row.tax[mIdx] += tax;
  }

  const rows = [...map.values()].map((r) => {
    r.income = r.income.map(round2) as [number, number, number];
    r.tax = r.tax.map(round2) as [number, number, number];
    r.incomeTotal = round2(r.income[0] + r.income[1] + r.income[2]);
    r.taxTotal = round2(r.tax[0] + r.tax[1] + r.tax[2]);
    return r;
  });
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.atcCode.localeCompare(b.atcCode));

  const totals = rows.reduce(
    (t, r) => {
      for (let i = 0; i < 3; i++) {
        t.income[i] = round2(t.income[i] + r.income[i]);
        t.tax[i] = round2(t.tax[i] + r.tax[i]);
      }
      t.incomeTotal = round2(t.incomeTotal + r.incomeTotal);
      t.taxTotal = round2(t.taxTotal + r.taxTotal);
      return t;
    },
    { income: [0, 0, 0] as [number, number, number], tax: [0, 0, 0] as [number, number, number], incomeTotal: 0, taxTotal: 0 }
  );

  return {
    year,
    quarter,
    months: [MONTHS[startMonth], MONTHS[startMonth + 1], MONTHS[startMonth + 2]] as [string, string, string],
    rows,
    totals,
  };
}

/**
 * Generates a BIR Alphalist QAP file: one H (taxpayer + grand totals) record
 * followed by one D record per payee + ATC, comma-delimited, using the same
 * sanitizing conventions as the SLS/SLP/SLI RELIEF files (commas stripped from
 * text, 9-digit TIN). Each D record carries the per-month income payment and
 * tax withheld plus their totals.
 *
 * NOTE: built to the shared H/D convention, not to a supplied QAP sample —
 * validate against BIR's Alphalist module before filing.
 */
export function buildQapDat(co: DatCompany, qap: Qap): string {
  const coTin = datTin(co.tin);
  const periodEnd = new Date(qap.year, qap.quarter * 3, 0); // last day of the quarter
  const pe = mmddyyyy(periodEnd);
  const t = qap.totals;
  const coIsPerson = Boolean(co.taxpayerLastName || co.taxpayerFirstName);
  const coReg = coIsPerson ? "" : datText(co.registeredName ?? co.tradeName ?? "");
  const coAddr1 = datText([co.businessAddress, co.barangay].filter(Boolean).join(" "));
  const coAddr2 = datText([co.city, co.province, co.zipCode].filter(Boolean).join(" "));

  const header = [
    "H", "Q", coTin, coReg,
    datText(co.taxpayerLastName), datText(co.taxpayerFirstName), datText(co.taxpayerMiddleName),
    datText(co.tradeName), coAddr1, coAddr2,
    amt(t.incomeTotal), amt(t.taxTotal),
    digitsOnly(co.rdoCode), pe, H_TRAILER,
  ].join(",");

  const details = qap.rows.map((r, i) =>
    [
      "D", "Q", String(i + 1), datTin(r.tin),
      r.isIndividual ? "" : datText(r.reg),
      datText(r.last), datText(r.first), datText(r.middle),
      datText(r.atcCode), datText(r.atcDescription), amt(r.ratePercent),
      amt(r.income[0]), amt(r.income[1]), amt(r.income[2]), amt(r.incomeTotal),
      amt(r.tax[0]), amt(r.tax[1]), amt(r.tax[2]), amt(r.taxTotal),
      coTin, pe,
    ].join(",")
  );

  return [header, ...details].join("\r\n") + "\r\n";
}
