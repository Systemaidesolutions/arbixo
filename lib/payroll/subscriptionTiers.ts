// ARbixo Payroll subscription tiers (pure helpers, safe for client components).
// A monthly payroll subscription covers up to N active payroll employees:
// 20, 50, 100, then every 100 (200, 300, 400 …).

export const FIRST_TIERS = [20, 50, 100];

export function isPayrollTier(n: number): boolean {
  return Number.isInteger(n) && (FIRST_TIERS.includes(n) || (n >= 200 && n % 100 === 0));
}

/** The smallest tier that fits this many employees. */
export function tierFor(count: number): number {
  for (const t of FIRST_TIERS) if (count <= t) return t;
  return Math.ceil(count / 100) * 100;
}

/** Tiers from 20 up to at least `upTo` (for pickers). */
export function tierLadder(upTo: number): number[] {
  const out = [...FIRST_TIERS];
  for (let t = 200; t <= Math.max(upTo, 1000); t += 100) out.push(t);
  return out;
}

export const tierLabel = (n: number | null | undefined) => (n ? `up to ${n} employees` : "");

/** Sortable month key (UTC). */
export const monthKey = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();

export const monthName = (key: number) =>
  new Date(Date.UTC(Math.floor(key / 12), key % 12, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Calendar months a payroll run belongs to: every month its period touches
 * (a weekly run over Jan 29 – Feb 4 needs both), or the pay-date month for a
 * 13th-month run (its period is the whole year).
 */
export function runMonths(run: { kind: string; periodStart: Date; periodEnd: Date; payDate: Date }): number[] {
  if (run.kind === "THIRTEENTH_MONTH") return [monthKey(run.payDate)];
  const out: number[] = [];
  for (let k = monthKey(run.periodStart); k <= monthKey(run.periodEnd); k++) out.push(k);
  return out;
}

/**
 * Why a run can't be edited or posted under this coverage (month → tier
 * paid), or null when it can.
 */
export function coverageProblem(coverage: Map<number, number>, months: number[], activeEmployees: number): string | null {
  const unpaid = months.filter((m) => !coverage.has(m));
  if (unpaid.length) {
    return `ARbixo Payroll isn't subscribed for ${unpaid.map(monthName).join(" and ")}. A Manager can subscribe under Setup › Subscription payments.`;
  }
  const short = months.find((m) => (coverage.get(m) ?? 0) < activeEmployees);
  if (short !== undefined) {
    return `You have ${activeEmployees} active payroll employees, but the ${monthName(short)} subscription covers ${tierLabel(coverage.get(short))}. Subscribe to the ${tierFor(activeEmployees)}-employee tier for that month, or untick "Include in payroll" for employees you don't pay.`;
  }
  return null;
}
