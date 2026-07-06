import { prisma } from "@/lib/prisma";
import { partyName } from "@/lib/slsp";
import type { Account, JournalType } from "@prisma/client";

// BIR Books of Accounts — the registered journals and ledger, as chronological
// listings for a period. The five journals are the same shape (one journal type
// each); the General Ledger is per-account with running balances.

function num(d: unknown): number {
  return Number(d ?? 0);
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function openingSigned(a: Pick<Account, "openingBalance" | "normalBalance">): number {
  const opening = num(a.openingBalance);
  return a.normalBalance === "DEBIT" ? opening : -opening;
}

export type BookLine = {
  id: string;
  entryNo: number;
  postingDate: string;
  documentNo: string;
  accountCode: string;
  accountTitle: string;
  particulars: string | null;
  counterparty: string | null;
  debit: number;
  credit: number;
};

/** A single-journal book (Cash Receipts, Cash Disbursements, General Journal,
 * Sales, or Purchases), chronological. */
export async function getJournalBook(
  companyId: string,
  journalTypes: JournalType[],
  from: Date,
  to: Date
): Promise<{ lines: BookLine[]; totalDebit: number; totalCredit: number }> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isCancelled: false,
      journalType: { in: journalTypes },
      postingDate: { gte: from, lte: to },
    },
    orderBy: [{ postingDate: "asc" }, { entryNo: "asc" }, { lineNo: "asc" }],
    include: { account: true, vendor: true, customer: true, employee: true, contact: true },
  });

  let totalDebit = 0;
  let totalCredit = 0;
  const lines: BookLine[] = entries.map((e) => {
    const cp = e.vendor ?? e.customer ?? e.employee ?? e.contact ?? null;
    const debit = num(e.debitAmount);
    const credit = num(e.creditAmount);
    totalDebit += debit;
    totalCredit += credit;
    return {
      id: e.id,
      entryNo: e.entryNo,
      postingDate: e.postingDate.toISOString(),
      documentNo: e.documentNo,
      accountCode: e.account.code,
      accountTitle: e.account.title,
      particulars: e.description,
      counterparty: cp ? partyName(cp) : null,
      debit: round2(debit),
      credit: round2(credit),
    };
  });

  return { lines, totalDebit: round2(totalDebit), totalCredit: round2(totalCredit) };
}

export type GLEntry = {
  postingDate: string;
  documentNo: string;
  journalType: JournalType;
  particulars: string | null;
  counterparty: string | null;
  debit: number;
  credit: number;
  balance: number;
};
export type GLAccountBook = {
  code: string;
  title: string;
  classification: string;
  beginningBalance: number;
  entries: GLEntry[];
  totalDebit: number;
  totalCredit: number;
  endingBalance: number;
};

/** General Ledger book — every account with activity (or an opening balance),
 * its entries in the period, and a running balance (debit-positive). */
export async function getGeneralLedgerBook(
  companyId: string,
  from: Date,
  to: Date
): Promise<{ accounts: GLAccountBook[]; totalDebit: number; totalCredit: number }> {
  const [accounts, prior, entries] = await Promise.all([
    prisma.account.findMany({
      where: { companyId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, title: true, classification: true, openingBalance: true, normalBalance: true },
    }),
    prisma.ledgerEntry.groupBy({
      by: ["accountId"],
      where: { companyId, isCancelled: false, postingDate: { lt: from } },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { companyId, isCancelled: false, postingDate: { gte: from, lte: to } },
      orderBy: [{ postingDate: "asc" }, { entryNo: "asc" }, { lineNo: "asc" }],
      include: { vendor: true, customer: true, employee: true, contact: true },
    }),
  ]);

  const priorMap = new Map(prior.map((g) => [g.accountId, num(g._sum.debitAmount) - num(g._sum.creditAmount)]));
  const byAccount = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = byAccount.get(e.accountId) ?? [];
    arr.push(e);
    byAccount.set(e.accountId, arr);
  }

  let grandDebit = 0;
  let grandCredit = 0;
  const result: GLAccountBook[] = [];

  for (const a of accounts) {
    const accEntries = byAccount.get(a.id) ?? [];
    const beginning = openingSigned(a) + (priorMap.get(a.id) ?? 0);
    if (Math.abs(beginning) < 0.005 && accEntries.length === 0) continue; // no activity, skip

    let balance = beginning;
    let td = 0;
    let tc = 0;
    const glEntries: GLEntry[] = accEntries.map((e) => {
      const cp = e.vendor ?? e.customer ?? e.employee ?? e.contact ?? null;
      const debit = num(e.debitAmount);
      const credit = num(e.creditAmount);
      balance += debit - credit;
      td += debit;
      tc += credit;
      return {
        postingDate: e.postingDate.toISOString(),
        documentNo: e.documentNo,
        journalType: e.journalType,
        particulars: e.description,
        counterparty: cp ? partyName(cp) : null,
        debit: round2(debit),
        credit: round2(credit),
        balance: round2(balance),
      };
    });
    grandDebit += td;
    grandCredit += tc;
    result.push({
      code: a.code,
      title: a.title,
      classification: a.classification,
      beginningBalance: round2(beginning),
      entries: glEntries,
      totalDebit: round2(td),
      totalCredit: round2(tc),
      endingBalance: round2(balance),
    });
  }

  return { accounts: result, totalDebit: round2(grandDebit), totalCredit: round2(grandCredit) };
}

// Book kind → journal types, for the shared journal-book route/UI.
export const JOURNAL_BOOKS: Record<string, { label: string; journalTypes: JournalType[] }> = {
  "cash-receipts": { label: "Cash Receipts Journal", journalTypes: ["CASH_RECEIPT"] },
  "cash-disbursement": { label: "Cash Disbursement Journal", journalTypes: ["CASH_DISBURSEMENT"] },
  "general-journal": { label: "General Journal", journalTypes: ["GENERAL_JOURNAL"] },
  sales: { label: "Sales Journal", journalTypes: ["SALES_ON_ACCOUNT"] },
  purchases: { label: "Purchase Journal", journalTypes: ["PURCHASE_ON_ACCOUNT"] },
};
