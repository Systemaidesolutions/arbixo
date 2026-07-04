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
  // Separate components for the BIR .DAT layout.
  reg: string;
  last: string;
  first: string;
  middle: string;
  addr1: string;
  addr2: string;
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
  // Separate components for the BIR .DAT layout.
  reg: string;
  last: string;
  first: string;
  middle: string;
  addr1: string;
  addr2: string;
  exempt: number;
  zeroRated: number;
  taxable: number;
  gross: number;
  outputTax: number;
};

export type Slp = { rows: SlpRow[]; totals: Omit<SlpRow, "id" | "tin" | "name" | "address" | "reg" | "last" | "first" | "middle" | "addr1" | "addr2"> };
export type Sls = { rows: SlsRow[]; totals: Omit<SlsRow, "id" | "tin" | "name" | "address" | "reg" | "last" | "first" | "middle" | "addr1" | "addr2"> };

// Summary List of Importations — one row per importation document, sourced
// from the import-specific fields on IMPORTATION ledger entries.
export type SliRow = {
  id: string;
  documentNo: string;
  entryNo: number;
  entryDeclNo: string; // Import Entry & Internal Revenue Declaration No.
  importDate: Date | null;
  releaseDate: Date | null; // assessment / release date
  sellerName: string;
  countryOrigin: string;
  dutiableValue: number;
  landedCost: number;
  vatPaid: number; // input VAT paid on importation
};
export type Sli = {
  rows: SliRow[];
  totals: { dutiableValue: number; landedCost: number; vatPaid: number };
};

export type DatCompany = {
  tin: string;
  registeredName: string | null;
  tradeName: string;
  taxpayerLastName: string | null;
  taxpayerFirstName: string | null;
  taxpayerMiddleName: string | null;
  businessAddress: string;
  barangay: string | null;
  city: string | null;
  province: string | null;
  zipCode: string;
  rdoCode: string;
};

// Trailing field of the H record. Both the client's SLP (5 rows) and SLS
// (3 rows) samples show a constant "12" regardless of row count or tax month,
// so it is emitted verbatim. Change here if BIR's RELIEF validator shows it is
// dynamic (e.g. tax-month number).
const H_TRAILER = "12";

const digitsOnly = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
// RELIEF files are positional and comma-delimited with NO quoting, so any comma
// or line break inside a text field shifts every field after it. Strip those
// (and collapse whitespace); other punctuation the validator accepts is kept.
const datText = (s: string | null | undefined) =>
  (s ?? "").replace(/[\r\n]+/g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
// BIR RELIEF identifies a taxpayer by the 9-digit base TIN — the export file is
// itself named "<9-digit TIN>...". Branch codes are not part of the TIN field,
// so use only the first 9 digits.
const datTin = (s: string | null | undefined) => digitsOnly(s).slice(0, 9);
// Match the sample's number style: integers plain, otherwise 2 decimals.
const amt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2));
function mmddyyyy(d: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
}

/**
 * Generates the BIR RELIEF SLP file text: one H (taxpayer + grand totals)
 * record followed by one D record per supplier, comma-delimited, matching the
 * client's sample layout.
 */
export function buildSlpDat(co: DatCompany, slp: Slp, periodEnd: Date): string {
  const coTin = datTin(co.tin);
  const me = mmddyyyy(periodEnd);
  const t = slp.totals;
  const coIsPerson = Boolean(co.taxpayerLastName || co.taxpayerFirstName);
  const coReg = coIsPerson ? "" : datText(co.registeredName ?? co.tradeName ?? "");
  const coAddr1 = datText([co.businessAddress, co.barangay].filter(Boolean).join(" "));
  const coAddr2 = datText([co.city, co.province, co.zipCode].filter(Boolean).join(" "));

  const header = [
    "H", "P", coTin, coReg,
    datText(co.taxpayerLastName), datText(co.taxpayerFirstName), datText(co.taxpayerMiddleName),
    datText(co.tradeName), coAddr1, coAddr2,
    amt(t.exempt), amt(t.zeroRated), amt(t.services), amt(t.capitalGoods), amt(t.goods),
    amt(t.inputTax), amt(t.inputTax), "0",
    digitsOnly(co.rdoCode), me, H_TRAILER,
  ].join(",");

  const details = slp.rows.map((r) =>
    [
      "D", "P", datTin(r.tin), datText(r.reg), datText(r.last), datText(r.first), datText(r.middle),
      datText(r.addr1), datText(r.addr2),
      amt(r.exempt), amt(r.zeroRated), amt(r.services), amt(r.capitalGoods), amt(r.goods),
      amt(r.inputTax), coTin, me,
    ].join(",")
  );

  return [header, ...details].join("\r\n") + "\r\n";
}

/**
 * Generates the BIR RELIEF SLS file text: one H (taxpayer + grand totals)
 * record followed by one D record per customer, comma-delimited, matching the
 * client's sample layout. SLS has a single taxable ("Vatable Sales") column,
 * so its records are shorter than SLP's.
 */
export function buildSlsDat(co: DatCompany, sls: Sls, periodEnd: Date): string {
  const coTin = datTin(co.tin);
  const me = mmddyyyy(periodEnd);
  const t = sls.totals;
  const coIsPerson = Boolean(co.taxpayerLastName || co.taxpayerFirstName);
  const coReg = coIsPerson ? "" : datText(co.registeredName ?? co.tradeName ?? "");
  const coAddr1 = datText([co.businessAddress, co.barangay].filter(Boolean).join(" "));
  const coAddr2 = datText([co.city, co.province, co.zipCode].filter(Boolean).join(" "));

  const header = [
    "H", "S", coTin, coReg,
    datText(co.taxpayerLastName), datText(co.taxpayerFirstName), datText(co.taxpayerMiddleName),
    datText(co.tradeName), coAddr1, coAddr2,
    amt(t.exempt), amt(t.zeroRated), amt(t.taxable), amt(t.outputTax),
    digitsOnly(co.rdoCode), me, H_TRAILER,
  ].join(",");

  const details = sls.rows.map((r) =>
    [
      "D", "S", datTin(r.tin), datText(r.reg), datText(r.last), datText(r.first), datText(r.middle),
      datText(r.addr1), datText(r.addr2),
      amt(r.exempt), amt(r.zeroRated), amt(r.taxable), amt(r.outputTax), coTin, me,
    ].join(",")
  );

  return [header, ...details].join("\r\n") + "\r\n";
}

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
      const isPerson = Boolean(l.vendor.lastName || l.vendor.firstName || l.vendor.middleName);
      row = {
        id: key,
        tin: l.vendor.tin ?? "",
        name: partyName(l.vendor),
        address: partyAddress(l.vendor),
        reg: isPerson ? "" : (l.vendor.registeredName ?? l.vendor.tradeName ?? ""),
        last: l.vendor.lastName ?? "",
        first: l.vendor.firstName ?? "",
        middle: l.vendor.middleName ?? "",
        addr1: [l.vendor.address, l.vendor.barangay].filter(Boolean).join(" "),
        addr2: [l.vendor.city, l.vendor.province, l.vendor.zipCode].filter(Boolean).join(" "),
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
      const isPerson = Boolean(l.customer.lastName || l.customer.firstName || l.customer.middleName);
      row = {
        id: key,
        tin: l.customer.tin ?? "",
        name: partyName(l.customer),
        address: partyAddress(l.customer),
        reg: isPerson ? "" : (l.customer.registeredName ?? l.customer.tradeName ?? ""),
        last: l.customer.lastName ?? "",
        first: l.customer.firstName ?? "",
        middle: l.customer.middleName ?? "",
        addr1: [l.customer.address, l.customer.barangay].filter(Boolean).join(" "),
        addr2: [l.customer.city, l.customer.province, l.customer.zipCode].filter(Boolean).join(" "),
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

/**
 * Summary List of Importations — one row per importation document, built from
 * the import-specific fields (import entry no., dates, dutiable value, landed
 * cost) plus the input VAT paid, on IMPORTATION ledger entries. Lines sharing a
 * documentNo are one importation, so metadata is taken from whichever line
 * carries it and the money columns are summed.
 */
export async function getSummaryListOfImportations(companyId: string, from: Date, to: Date): Promise<Sli> {
  const lines = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      postingDate: { gte: from, lte: to },
      vatType: "IMPORTATION",
    },
    orderBy: [{ postingDate: "asc" }, { entryNo: "asc" }],
  });

  const map = new Map<string, SliRow>();
  for (const l of lines) {
    const key = l.documentNo || l.id;
    let row = map.get(key);
    if (!row) {
      row = {
        id: key,
        documentNo: l.documentNo,
        entryNo: l.entryNo,
        entryDeclNo: "",
        importDate: null,
        releaseDate: null,
        sellerName: "",
        countryOrigin: "",
        dutiableValue: 0,
        landedCost: 0,
        vatPaid: 0,
      };
      map.set(key, row);
    }
    // Metadata: keep the first non-empty value seen across the document's lines.
    if (!row.entryDeclNo && l.importEntryNo) row.entryDeclNo = l.importEntryNo;
    if (!row.sellerName && l.importSellerName) row.sellerName = l.importSellerName;
    if (!row.countryOrigin && l.importCountryOrigin) row.countryOrigin = l.importCountryOrigin;
    if (!row.importDate && l.importDate) row.importDate = l.importDate;
    if (!row.releaseDate && l.importAssessDate) row.releaseDate = l.importAssessDate;
    row.dutiableValue += num(l.importDutiableValue);
    row.landedCost += num(l.importLandedCost);
    row.vatPaid += num(l.vatAmount);
  }

  const rows = [...map.values()].map((r) => ({
    ...r,
    dutiableValue: round2(r.dutiableValue),
    landedCost: round2(r.landedCost),
    vatPaid: round2(r.vatPaid),
  }));
  rows.sort((a, b) => {
    const ad = a.importDate?.getTime() ?? 0;
    const bd = b.importDate?.getTime() ?? 0;
    return ad - bd || a.entryNo - b.entryNo;
  });

  const totals = rows.reduce(
    (t, r) => ({
      dutiableValue: round2(t.dutiableValue + r.dutiableValue),
      landedCost: round2(t.landedCost + r.landedCost),
      vatPaid: round2(t.vatPaid + r.vatPaid),
    }),
    { dutiableValue: 0, landedCost: 0, vatPaid: 0 }
  );

  return { rows, totals };
}
