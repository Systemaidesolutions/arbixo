import { prisma } from "@/lib/prisma";

// Transaction-date coverage: a company may only post a transaction dated
// within a calendar month it actually paid a subscription for. Built from
// the VERIFIED SubscriptionPayment chain (not just Company.subscription-
// StartedAt/EndsAt) so a lapsed month stays blocked even after
// resubscribing later — those two summary fields alone can't tell a
// continuous history from one with a gap.
//
// Kept out of lib/subscription.ts, which is imported by client components
// (e.g. SubscriptionPanel.tsx) — importing prisma there would pull
// next/headers into the client bundle and break the build.

/** Sortable "months since epoch" key — UTC, since postingDate is stored as
 * UTC midnight for the intended calendar date (see other date handling in
 * this codebase); using local accessors here would drift on a non-UTC host. */
function monthKey(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** Inclusive [startMonth, endMonth] a single period covers, rounded to whole
 * calendar months. `end` is treated as exclusive (coverage runs up to, not
 * including, that instant) — otherwise a period ending exactly on the 1st
 * (e.g. Aug 1 -> Sep 1, one month of coverage) would wrongly look like it
 * covers September too. */
function periodMonthRange(start: Date, end: Date): [number, number] {
  const lastCoveredInstant = new Date(end.getTime() - 1);
  return [monthKey(start), monthKey(lastCoveredInstant)];
}

export type SubscriptionCoverage = { monthRanges: [number, number][] };

/**
 * Every month range a company has paid for, fetched once so callers
 * checking many dates (e.g. a bulk import) don't re-query per row.
 */
export async function getSubscriptionCoverage(companyId: string): Promise<SubscriptionCoverage> {
  const payments = await prisma.subscriptionPayment.findMany({
    where: { companyId, status: "VERIFIED", periodStart: { not: null }, periodEnd: { not: null } },
    select: { periodStart: true, periodEnd: true },
  });
  if (payments.length > 0) {
    return { monthRanges: payments.map((p) => periodMonthRange(p.periodStart!, p.periodEnd!)) };
  }

  // No payment history at all — fall back to the Company summary fields so a
  // manually-configured legacy company (no SubscriptionPayment rows) isn't
  // locked out entirely. Can't detect gaps this way, but there's no history
  // to have gaps in.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStartedAt: true, subscriptionEndsAt: true },
  });
  if (!company?.subscriptionStartedAt || !company.subscriptionEndsAt) return { monthRanges: [] };
  return { monthRanges: [periodMonthRange(company.subscriptionStartedAt, company.subscriptionEndsAt)] };
}

/** Pure check against already-fetched coverage — use in a loop to avoid re-querying. */
export function isMonthCovered(coverage: SubscriptionCoverage, date: Date): boolean {
  const key = monthKey(date);
  return coverage.monthRanges.some(([s, e]) => key >= s && key <= e);
}

/** Convenience one-shot version for single-transaction call sites. */
export async function isPostingDateSubscriptionCovered(companyId: string, date: Date): Promise<boolean> {
  return isMonthCovered(await getSubscriptionCoverage(companyId), date);
}

/** Parses an <input type="month"> value ("YYYY-MM") into the calendar month's
 * [periodStart, periodEnd) — first-of-month through first-of-next-month,
 * matching the half-open shape periodMonthRange() above expects. */
export function monthStringToPeriod(monthStr: string): { periodStart: Date; periodEnd: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Invalid month "${monthStr}" — expected YYYY-MM.`);
  return {
    periodStart: new Date(Date.UTC(y, m - 1, 1)),
    periodEnd: new Date(Date.UTC(y, m, 1)),
  };
}

/**
 * Recomputes Company.subscriptionStartedAt/EndsAt from the VERIFIED
 * SubscriptionPayment chain (earliest periodStart, latest periodEnd) — call
 * after creating or verifying a payment for any month, including one that
 * doesn't roll forward from "now" (e.g. backfilling an earlier month, or a
 * bulk grant). Keeps those two summary fields meaningful as "furthest paid
 * span" even when months were paid out of order.
 */
export async function recomputeCompanySubscriptionSummary(companyId: string): Promise<void> {
  const agg = await prisma.subscriptionPayment.aggregate({
    where: { companyId, status: "VERIFIED", periodStart: { not: null }, periodEnd: { not: null } },
    _min: { periodStart: true },
    _max: { periodEnd: true },
  });
  if (!agg._min.periodStart || !agg._max.periodEnd) return;
  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionStartedAt: agg._min.periodStart,
      subscriptionEndsAt: agg._max.periodEnd,
      subscriptionReminderSentAt: null,
    },
  });
}
