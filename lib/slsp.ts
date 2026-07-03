import { prisma } from "@/lib/prisma";

// BIR Summary Lists of Sales (SLS) and Purchases (SLP) — one summarized line
// per customer / supplier for a period, split by VAT treatment. Purchases
// additionally split taxable amounts into Goods / Services / Capital Goods
// using the line's taxSource.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function num(d: unknown): number {
  return Number(d ?? 0);
}

type PartyLike = {
  tin: string | null;
  taxClassification?: string | null;
  registeredName?: string | null;
  tradeName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  address?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  zipCode?: string | null;
};

export function partyName(p: PartyLike): string {
  const isPerson = Boolean(p.lastName || p.firstName || p.middleName);
  if (isPerson) {
    return `${p.lastName ?? ""}, ${p.firstName ?? ""} ${p.middleName ?? ""}`.replace(/\s+/g, " ").trim();
  }
  return (p.registeredName ?? p.tradeName ?? "").trim();
}

export function partyAddress(p: PartyLike): string {
  return [p.address, p.barangay, p.city, p.province, p.zipCode].filter(Boolean).join(", ");
}

export type SlpRow = {
  id: string;
  tin: string;
  name: string;
  address: string;
  exempt: number;
  zeroRated: number;
  services: number;
  capitalGoods: number;
  goods: number;
  taxable: number;
  gross: number;
  inputTax: number;
};

export type SlsRow = {
  id: string;
  tin: string;
  name: string;
  address: string;
  exempt: number;
  zeroRated: number;
  taxable: number;
  gross: number;
  outputTax: number;
};

export type Slp = { rows: SlpRow[]; totals: Omit<SlpRow, "id" | "tin" | "name" | "address"> };
export type Sls = { rows: SlsRow[]; totals: Omit<SlsRow, "id" | "tin" | "name" | "address"> };

export async function getSummaryListOfPurchases(companyId: string, from: Date, to: Date): Promise<Slp> {
  const lines = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      postingDate: { gte: from, lte: to },
      journalType: { in: ["PURCHASE_ON_ACCOUNT", "CASH_DISBURSEMENT"] },
      vendorId: { not: null },
      vatType: { in: ["VAT_12", "ZERO_RATED", "VAT_EXEMPT"] },
    },
    include: { vendor: true },
  });

  const map = new Map<string, SlpRow>();
  for (const l of lines) {
    if (!l.vendor) continue;
    const sign = num(l.debitAmount) > 0 ? 1 : -1; // purchase returns net out
    const net = num(l.netAmount) * sign;
    const vat = num(l.vatAmount) * sign;
    const key = l.vendor.id;
    let row = map.get(key);
    if (!row) {
      row = {
        id: key,
        tin: l.vendor.tin ?? "",
        name: partyName(l.vendor),
        address: partyAddress(l.vendor),
        exempt: 0, zeroRated: 0, services: 0, capitalGoods: 0, goods: 0, taxable: 0, gross: 0, inputTax: 0,
      };
      map.set(key, row);
    }
    if (l.vatType === "VAT_EXEMPT") row.exempt += net;
    else if (l.vatType === "ZERO_RATED") row.zeroRated += net;
    else if (l.vatType === "VAT_12") {
      if (l.taxSource === "SERVICE") row.services += net;
      else if (l.taxSource === "CAPITAL_GOODS") row.capitalGoods += net;
      else row.goods += net;
      row.inputTax += vat;
    }
  }

  const rows = [...map.values()].map((r) => {
    r.taxable = round2(r.services + r.capitalGoods + r.goods);
    r.services = round2(r.services);
    r.capitalGoods = round2(r.capitalGoods);
    r.goods = round2(r.goods);
    r.exempt = round2(r.exempt);
    r.zeroRated = round2(r.zeroRated);
    r.inputTax = round2(r.inputTax);
    r.gross = round2(r.exempt + r.zeroRated + r.taxable);
    return r;
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (t, r) => ({
      exempt: round2(t.exempt + r.exempt),
      zeroRated: round2(t.zeroRated + r.zeroRated),
      services: round2(t.services + r.services),
      capitalGoods: round2(t.capitalGoods + r.capitalGoods),
      goods: round2(t.goods + r.goods),
      taxable: round2(t.taxable + r.taxable),
      gross: round2(t.gross + r.gross),
      inputTax: round2(t.inputTax + r.inputTax),
    }),
    { exempt: 0, zeroRated: 0, services: 0, capitalGoods: 0, goods: 0, taxable: 0, gross: 0, inputTax: 0 }
  );

  return { rows, totals };
}

export async function getSummaryListOfSales(companyId: string, from: Date, to: Date): Promise<Sls> {
  const lines = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      postingDate: { gte: from, lte: to },
      journalType: { in: ["SALES_ON_ACCOUNT", "CASH_RECEIPT"] },
      customerId: { not: null },
      vatType: { in: ["VAT_12", "ZERO_RATED", "VAT_EXEMPT"] },
    },
    include: { customer: true },
  });

  const map = new Map<string, SlsRow>();
  for (const l of lines) {
    if (!l.customer) continue;
    const sign = num(l.creditAmount) > 0 ? 1 : -1; // sales returns net out
    const net = num(l.netAmount) * sign;
    const vat = num(l.vatAmount) * sign;
    const key = l.customer.id;
    let row = map.get(key);
    if (!row) {
      row = {
        id: key,
        tin: l.customer.tin ?? "",
        name: partyName(l.customer),
        address: partyAddress(l.customer),
        exempt: 0, zeroRated: 0, taxable: 0, gross: 0, outputTax: 0,
      };
      map.set(key, row);
    }
    if (l.vatType === "VAT_EXEMPT") row.exempt += net;
    else if (l.vatType === "ZERO_RATED") row.zeroRated += net;
    else if (l.vatType === "VAT_12") {
      row.taxable += net;
      row.outputTax += vat;
    }
  }

  const rows = [...map.values()].map((r) => {
    r.exempt = round2(r.exempt);
    r.zeroRated = round2(r.zeroRated);
    r.taxable = round2(r.taxable);
    r.outputTax = round2(r.outputTax);
    r.gross = round2(r.exempt + r.zeroRated + r.taxable);
    return r;
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (t, r) => ({
      exempt: round2(t.exempt + r.exempt),
      zeroRated: round2(t.zeroRated + r.zeroRated),
      taxable: round2(t.taxable + r.taxable),
      gross: round2(t.gross + r.gross),
      outputTax: round2(t.outputTax + r.outputTax),
    }),
    { exempt: 0, zeroRated: 0, taxable: 0, gross: 0, outputTax: 0 }
  );

  return { rows, totals };
}
