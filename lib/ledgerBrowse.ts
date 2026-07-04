import { prisma } from "@/lib/prisma";
import { partyName } from "@/lib/slsp";
import type { JournalType, Prisma } from "@prisma/client";

function num(d: unknown): number {
  return Number(d ?? 0);
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type LedgerBrowseRow = {
  id: string;
  entryNo: number;
  postingDate: string;
  journalType: JournalType;
  documentNo: string;
  accountCode: string;
  accountTitle: string;
  counterparty: string | null;
  description: string | null;
  debit: number;
  credit: number;
};

export type BrowseOptions = {
  journalTypes?: JournalType[];
  from?: Date;
  to?: Date;
  search?: string;
  take: number;
  skip: number;
};

// Flat, filterable list of posted ledger lines — the Business Central
// "General Ledger Entries" browser, plus sales/purchase-scoped variants.
export async function browseLedgerEntries(companyId: string, opts: BrowseOptions) {
  const where: Prisma.LedgerEntryWhereInput = {
    companyId,
    isCancelled: false,
    ...(opts.journalTypes?.length ? { journalType: { in: opts.journalTypes } } : {}),
    ...(opts.from || opts.to
      ? { postingDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
      : {}),
    ...(opts.search
      ? {
          OR: [
            { documentNo: { contains: opts.search, mode: "insensitive" } },
            { description: { contains: opts.search, mode: "insensitive" } },
            { account: { code: { contains: opts.search, mode: "insensitive" } } },
            { account: { title: { contains: opts.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, agg, entries] = await Promise.all([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.aggregate({ where, _sum: { debitAmount: true, creditAmount: true } }),
    prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ postingDate: "desc" }, { entryNo: "desc" }],
      take: opts.take,
      skip: opts.skip,
      include: { account: true, vendor: true, customer: true, employee: true, contact: true },
    }),
  ]);

  const rows: LedgerBrowseRow[] = entries.map((e) => {
    const cp = e.vendor ?? e.customer ?? e.employee ?? e.contact ?? null;
    return {
      id: e.id,
      entryNo: e.entryNo,
      postingDate: e.postingDate.toISOString(),
      journalType: e.journalType,
      documentNo: e.documentNo,
      accountCode: e.account.code,
      accountTitle: e.account.title,
      counterparty: cp ? partyName(cp) : null,
      description: e.description,
      debit: num(e.debitAmount),
      credit: num(e.creditAmount),
    };
  });

  return {
    rows,
    total,
    totalDebit: round2(num(agg._sum.debitAmount)),
    totalCredit: round2(num(agg._sum.creditAmount)),
  };
}
