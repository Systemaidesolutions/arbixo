import { prisma } from "@/lib/prisma";
import { partyName } from "@/lib/slsp";
import { branchWhere, type BranchScope } from "@/lib/branchScope";

// Data behind BIR Form 2307 (Certificate of Creditable Tax Withheld at Source)
// issued as a REPORT — one certificate per payee for the period, consolidating
// every payment to that payee. The official form splits income across the
// quarter's three months, which is why entries are bucketed by month position
// within the selected range (the per-transaction certificate, printed from a
// posted document, keeps its own single-month behaviour).

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function num(d: unknown): number {
  return Number(d ?? 0);
}

export type Row2307Detail = {
  atc: string;
  description: string;
  /** Income per month of the quarter — index 0/1/2. */
  months: [number, number, number];
  income: number;
  tax: number;
};

export type Payee2307 = {
  id: string;
  name: string;
  tin: string;
  address: string;
  zip: string;
  rows: Row2307Detail[];
  totalIncome: number;
  totalTax: number;
};

export type Report2307 = {
  payees: Payee2307[];
  totals: { income: number; tax: number };
};

type PartyLike = {
  tin: string | null;
  registeredName?: string | null;
  tradeName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  address?: string | null;
  barangay?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  zipCode?: string | null;
};

/** Address for the certificate — zip is a separate boxed field on the form. */
function addressOf(p: PartyLike): string {
  return [p.address, p.barangay, p.district, p.city, p.province].filter(Boolean).join(", ");
}

/** Month position (0-2) of a date relative to the period start. */
function monthIndex(date: Date, from: Date): 0 | 1 | 2 {
  const diff =
    (date.getFullYear() - from.getFullYear()) * 12 + (date.getMonth() - from.getMonth());
  return (diff < 0 ? 0 : diff > 2 ? 2 : diff) as 0 | 1 | 2;
}

/**
 * Every payee the company withheld EWT from in the period, with their income
 * payments split by month of the quarter and grouped by ATC — i.e. exactly what
 * each payee's 2307 needs.
 */
export async function get2307Payees(
  companyId: string,
  from: Date,
  to: Date,
  branch?: BranchScope
): Promise<Report2307> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      ...branchWhere(branch ?? null),
      isCancelled: false,
      postingDate: { gte: from, lte: to },
      // The company is the withholding agent on money it pays out.
      journalType: { in: ["PURCHASE_ON_ACCOUNT", "CASH_DISBURSEMENT"] },
      atcCode: { not: null },
    },
    include: { vendor: true, contact: true, employee: true, customer: true },
  });

  const byPayee = new Map<string, Payee2307>();

  for (const e of entries) {
    let key: string | null = null;
    let party: PartyLike | null = null;
    if (e.vendorId && e.vendor) [key, party] = [`v:${e.vendorId}`, e.vendor];
    else if (e.contactId && e.contact) [key, party] = [`c:${e.contactId}`, e.contact];
    else if (e.employeeId && e.employee) [key, party] = [`e:${e.employeeId}`, e.employee];
    else if (e.customerId && e.customer) [key, party] = [`cu:${e.customerId}`, e.customer];
    if (!key || !party) continue;

    let payee = byPayee.get(key);
    if (!payee) {
      payee = {
        id: key,
        name: partyName(party),
        tin: party.tin ?? "",
        address: addressOf(party),
        zip: party.zipCode ?? "",
        rows: [],
        totalIncome: 0,
        totalTax: 0,
      };
      byPayee.set(key, payee);
    }

    const atc = e.atcCode!;
    let row = payee.rows.find((r) => r.atc === atc);
    if (!row) {
      row = { atc, description: e.atcDescription ?? "", months: [0, 0, 0], income: 0, tax: 0 };
      payee.rows.push(row);
    }

    // Income base = the main line's amount; a return nets back out.
    const sign = e.isReturn ? -1 : 1;
    const income = (num(e.debitAmount) + num(e.creditAmount)) * sign;
    const tax = num(e.withholdingAmt) * sign;

    row.months[monthIndex(e.postingDate, from)] += income;
    row.income += income;
    row.tax += tax;
  }

  const payees = [...byPayee.values()]
    .map((p) => {
      const rows = p.rows
        .map((r) => ({
          ...r,
          months: r.months.map(round2) as [number, number, number],
          income: round2(r.income),
          tax: round2(r.tax),
        }))
        .sort((a, b) => a.atc.localeCompare(b.atc));
      return {
        ...p,
        rows,
        totalIncome: round2(rows.reduce((s, r) => s + r.income, 0)),
        totalTax: round2(rows.reduce((s, r) => s + r.tax, 0)),
      };
    })
    // Drop payees whose activity nets to nothing (e.g. fully reversed).
    .filter((p) => Math.abs(p.totalIncome) > 0.005 || Math.abs(p.totalTax) > 0.005)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totals = payees.reduce(
    (t, p) => ({ income: round2(t.income + p.totalIncome), tax: round2(t.tax + p.totalTax) }),
    { income: 0, tax: 0 }
  );

  return { payees, totals };
}
