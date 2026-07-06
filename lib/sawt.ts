import { prisma } from "@/lib/prisma";
import { partyName, type DatCompany } from "@/lib/slsp";

// BIR SAWT (Summary Alphalist of Withholding Taxes) — the creditable withholding
// tax the company had withheld FROM it by its customers/payors on income
// (sales / cash receipts). Mirror of QAP (which is the withholding-agent side).
// Filed quarterly as an attachment (the sample uses the 1701Q form indicator).

const SAWT_FORM = "1701Q"; // form the SAWT is attached to (from the sample)

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function num(d: unknown): number {
  return Number(d ?? 0);
}

export type SawtRow = {
  id: string;
  tin: string;
  isIndividual: boolean;
  reg: string;
  last: string;
  first: string;
  middle: string;
  name: string; // display
  atcCode: string;
  atcDescription: string;
  ratePercent: number;
  income: number;
  tax: number;
};

export type Sawt = {
  rows: SawtRow[];
  totals: { income: number; tax: number };
};

export async function getSummaryAlphalistOfWithholdingTaxes(
  companyId: string,
  from: Date,
  to: Date,
  locationId?: string
): Promise<Sawt> {
  const [entries, atcCodes] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        ...(locationId ? { locationId } : {}),
        isCancelled: false,
        postingDate: { gte: from, lte: to },
        // The company is the payee here; its customers withheld from its income.
        journalType: { in: ["SALES_ON_ACCOUNT", "CASH_RECEIPT"] },
        atcCode: { not: null },
      },
      include: { customer: true },
    }),
    prisma.atcCode.findMany(),
  ]);
  const rateByCode = new Map(atcCodes.map((a) => [a.code, Number(a.ratePercent)]));

  const map = new Map<string, SawtRow>();
  for (const e of entries) {
    if (!e.customer) continue;
    const atc = e.atcCode!;
    const key = `${e.customer.id}|${atc}`;
    let row = map.get(key);
    if (!row) {
      const c = e.customer;
      const isIndividual = Boolean(c.lastName || c.firstName || c.middleName);
      row = {
        id: key,
        tin: c.tin ?? "",
        isIndividual,
        reg: isIndividual ? "" : (c.registeredName ?? c.tradeName ?? ""),
        last: c.lastName ?? "",
        first: c.firstName ?? "",
        middle: c.middleName ?? "",
        name: partyName(c),
        atcCode: atc,
        atcDescription: e.atcDescription ?? "",
        ratePercent: rateByCode.get(atc) ?? 0,
        income: 0,
        tax: 0,
      };
      map.set(key, row);
    }
    const sign = e.isReturn ? -1 : 1;
    // Income base = the sale's net (its credit, or debit on a return).
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

// ---- .DAT (BIR Alphalist SAWT) ----

const stripQuotes = (s: string | null | undefined) => (s ?? "").replace(/["\r\n]/g, " ").replace(/\s+/g, " ").trim();
const qAlways = (s: string | null | undefined) => `"${stripQuotes(s)}"`;
const qIf = (s: string | null | undefined) => (stripQuotes(s) ? `"${stripQuotes(s)}"` : "");
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const tin9 = (s: string | null | undefined) => digits(s).slice(0, 9);
const branch4 = (s: string | null | undefined) => digits(s).slice(9, 13).padEnd(4, "0");
const amt2 = (n: number) => n.toFixed(2);
const rdoCode = (s: string | null | undefined) => (s ?? "").trim().match(/^[0-9A-Za-z]+/)?.[0] ?? "";

/**
 * Builds the BIR Alphalist SAWT file: an H (taxpayer header) record, one D
 * record per payor + ATC, and a C (control totals) record. Text fields are
 * quoted; amounts carry two decimals. Company TIN split into 9-digit + 4-digit
 * branch. Matches the client's sample layout.
 */
export function buildSawtDat(co: DatCompany, sawt: Sawt, periodEnd: Date): string {
  const period = `${String(periodEnd.getMonth() + 1).padStart(2, "0")}/${periodEnd.getFullYear()}`;
  const coTin = tin9(co.tin);
  const coBranch = branch4(co.tin);
  const coIsPerson = Boolean(co.taxpayerLastName || co.taxpayerFirstName);
  const coReg = coIsPerson ? "" : (co.registeredName ?? co.tradeName ?? "");

  const header = [
    "HSAWT", `H${SAWT_FORM}`, coTin, coBranch,
    qAlways(coReg), qAlways(co.taxpayerLastName), qAlways(co.taxpayerFirstName), qAlways(co.taxpayerMiddleName),
    period, rdoCode(co.rdoCode),
  ].join(",");

  const details = sawt.rows.map((r, i) =>
    [
      "DSAWT", `D${SAWT_FORM}`, String(i + 1), tin9(r.tin), branch4(r.tin),
      r.isIndividual ? "" : qIf(r.reg),
      r.isIndividual ? qIf(r.last) : "",
      r.isIndividual ? qIf(r.first) : "",
      r.isIndividual ? qIf(r.middle) : "",
      period, "", r.atcCode, amt2(r.ratePercent), amt2(r.income), amt2(r.tax),
    ].join(",")
  );

  const control = [
    "CSAWT", `C${SAWT_FORM}`, coTin, coBranch, period, amt2(sawt.totals.income), amt2(sawt.totals.tax),
  ].join(",");

  return [header, ...details, control].join("\r\n") + "\r\n";
}
