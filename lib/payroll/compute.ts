// Pure payroll computation — no DB access, so it runs the same on the server
// (when saving/posting a run) and in the browser (live preview while encoding).
//
// Statutory tables are the 2025 rates. They're kept here as plain functions so
// a future rate change is a one-file edit (or can be moved into PayrollSetup).

export type PayBasis = "MONTHLY" | "DAILY";
export type PayFrequency = "MONTHLY" | "SEMI_MONTHLY" | "WEEKLY" | "DAILY";
export type DayType = "REG" | "RD" | "SH" | "RH";

export type PayrollRules = {
  workDaysPerYear: number;
  hoursPerDay: number;
  otMultiplier: number;
  restDayMultiplier: number;
  specialHolidayMultiplier: number;
  regularHolidayMultiplier: number;
  nightDiffRate: number;
  payUnworkedRegularHoliday: boolean;
};

export const DEFAULT_RULES: PayrollRules = {
  workDaysPerYear: 313,
  hoursPerDay: 8,
  otMultiplier: 1.25,
  restDayMultiplier: 1.3,
  specialHolidayMultiplier: 1.3,
  regularHolidayMultiplier: 2,
  nightDiffRate: 0.1,
  payUnworkedRegularHoliday: true,
};

export type GroupRules = {
  frequency: PayFrequency;
  deductSss: boolean;
  deductPhilhealth: boolean;
  deductHdmf: boolean;
  withholdTax: boolean;
};

export type Adjustment = { payItemId: string; code: string; name: string; kind: "EARNING" | "DEDUCTION"; taxable: boolean; amount: number };

export type LineInput = {
  payBasis: PayBasis;
  rate: number;
  isMinimumWage: boolean;
  attendance?: Record<string, number> | null; // DAILY: days worked per ISO date
  absentDays?: number; // MONTHLY
  lateMinutes?: number;
  otHours?: number;
  nightDiffHours?: number;
  adjustments?: Adjustment[];
  // Approved leave in the period, one entry per date (see lib/payroll/leave.ts).
  leaves?: { date: string; days: number; paid: boolean }[] | null;
};

export type RunContext = {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  dayTypes?: Record<string, DayType> | null;
  rules: PayrollRules;
  group: GroupRules;
};

export type LineResult = {
  daysWorked: number;
  basicPay: number;
  premiumPay: number;
  leaveDays: number;
  leavePay: number;
  unpaidLeaveDays: number;
  otPay: number;
  nightDiffPay: number;
  lateDeduction: number;
  otherEarnings: number;
  grossPay: number;
  sssEe: number;
  sssEr: number;
  philhealthEe: number;
  philhealthEr: number;
  hdmfEe: number;
  hdmfEr: number;
  taxableIncome: number;
  withholdingTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Every ISO date (YYYY-MM-DD) from start to end inclusive, timezone-safe. */
export function periodDates(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  for (let i = 0; d <= last && i < 62; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** How many runs of this group fall in a year — used to annualize tax and split monthly contributions. */
export function periodsPerYear(frequency: PayFrequency, periodDayCount: number): number {
  switch (frequency) {
    case "MONTHLY": return 12;
    case "SEMI_MONTHLY": return 24;
    case "WEEKLY": return 52;
    case "DAILY": return 365 / Math.max(1, periodDayCount);
  }
}

// ---------------- Statutory contributions (monthly amounts) ----------------

/** SSS 2025: 15% of the Monthly Salary Credit (EE 5%, ER 10%), MSC 5,000–35,000 in 500 steps, plus employer EC. */
export function sssMonthly(monthlyComp: number): { ee: number; er: number } {
  if (monthlyComp <= 0) return { ee: 0, er: 0 };
  const msc = Math.min(35000, Math.max(5000, Math.floor((monthlyComp + 250) / 500) * 500));
  const ec = msc < 15000 ? 10 : 30;
  return { ee: round2(msc * 0.05), er: round2(msc * 0.1 + ec) };
}

/** PhilHealth 2025: 5% of monthly basic salary (floor 10,000, ceiling 100,000), shared equally. */
export function philhealthMonthly(monthlyBasic: number): { ee: number; er: number } {
  if (monthlyBasic <= 0) return { ee: 0, er: 0 };
  const base = Math.min(100000, Math.max(10000, monthlyBasic));
  const half = round2((base * 0.05) / 2);
  return { ee: half, er: half };
}

/** Pag-IBIG: EE 1% (≤1,500) or 2%, ER 2%, on a fund salary capped at 10,000. */
export function hdmfMonthly(monthlyComp: number): { ee: number; er: number } {
  if (monthlyComp <= 0) return { ee: 0, er: 0 };
  const base = Math.min(10000, monthlyComp);
  return { ee: round2(base * (monthlyComp <= 1500 ? 0.01 : 0.02)), er: round2(base * 0.02) };
}

/** Annual income tax on compensation (TRAIN table, 2023 onward). */
export function annualIncomeTax(annualTaxable: number): number {
  const t = annualTaxable;
  if (t <= 250000) return 0;
  if (t <= 400000) return (t - 250000) * 0.15;
  if (t <= 800000) return 22500 + (t - 400000) * 0.2;
  if (t <= 2000000) return 102500 + (t - 800000) * 0.25;
  if (t <= 8000000) return 402500 + (t - 2000000) * 0.3;
  return 2202500 + (t - 8000000) * 0.35;
}

// ---------------- Line computation ----------------

export function computeLine(input: LineInput, ctx: RunContext): LineResult {
  const { rules, group } = ctx;
  const dates = periodDates(ctx.periodStart, ctx.periodEnd);
  const ppy = periodsPerYear(group.frequency, dates.length);
  const runsPerMonth = ppy / 12;
  const dayTypes = ctx.dayTypes ?? {};

  const dailyRate = input.payBasis === "DAILY" ? input.rate : (input.rate * 12) / rules.workDaysPerYear;
  const hourlyRate = dailyRate / (rules.hoursPerDay || 8);

  let daysWorked = 0;
  let basicPay = 0;
  let premiumPay = 0;
  let leavePay = 0;
  const leaves = input.leaves ?? [];
  const leaveDays = leaves.filter((l) => l.paid).reduce((s, l) => s + (Number(l.days) || 0), 0);
  const unpaidLeaveDays = leaves.filter((l) => !l.paid).reduce((s, l) => s + (Number(l.days) || 0), 0);

  if (input.payBasis === "DAILY") {
    // Pay per date actually worked; the date's day type sets the multiplier.
    // The 100% part goes to basic pay, anything above it to premium pay.
    const att = input.attendance ?? {};
    const paidLeave = new Map<string, number>();
    for (const l of leaves) if (l.paid) paidLeave.set(l.date, (paidLeave.get(l.date) ?? 0) + (Number(l.days) || 0));
    for (const date of dates) {
      const days = Math.max(0, Number(att[date]) || 0);
      const type = dayTypes[date] ?? "REG";
      // Paid leave pays the daily rate on a workday or special day. A rest day
      // isn't paid anyway, and an unworked regular holiday is already paid below.
      const onLeave = paidLeave.get(date) ?? 0;
      if (onLeave > 0 && (type === "REG" || type === "SH")) leavePay += dailyRate * Math.min(1, onLeave);
      if (days > 0) {
        daysWorked += days;
        const mult =
          type === "RD" ? rules.restDayMultiplier
          : type === "SH" ? rules.specialHolidayMultiplier
          : type === "RH" ? rules.regularHolidayMultiplier
          : 1;
        basicPay += dailyRate * days;
        premiumPay += dailyRate * days * (mult - 1);
      } else if (type === "RH" && rules.payUnworkedRegularHoliday) {
        basicPay += dailyRate;
      }
    }
  } else {
    // Fixed salary split evenly across the month's runs, less absences and
    // unpaid leave. Paid leave is already covered by the salary.
    const absent = Math.max(0, input.absentDays ?? 0) + unpaidLeaveDays;
    basicPay = input.rate / runsPerMonth - dailyRate * absent;
    daysWorked = Math.max(0, rules.workDaysPerYear / ppy - absent - leaveDays);
  }

  const otPay = hourlyRate * rules.otMultiplier * Math.max(0, input.otHours ?? 0);
  const nightDiffPay = hourlyRate * rules.nightDiffRate * Math.max(0, input.nightDiffHours ?? 0);
  const lateDeduction = (hourlyRate / 60) * Math.max(0, input.lateMinutes ?? 0);

  const adjustments = input.adjustments ?? [];
  const earnings = adjustments.filter((a) => a.kind === "EARNING");
  const otherEarnings = earnings.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const nonTaxableEarnings = earnings.filter((a) => !a.taxable).reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const otherDeductions = adjustments.filter((a) => a.kind === "DEDUCTION").reduce((s, a) => s + (Number(a.amount) || 0), 0);

  const r = {
    basicPay: round2(Math.max(0, basicPay)),
    premiumPay: round2(premiumPay),
    leavePay: round2(leavePay),
    otPay: round2(otPay),
    nightDiffPay: round2(nightDiffPay),
    lateDeduction: round2(lateDeduction),
  };
  const grossPay = round2(r.basicPay + r.premiumPay + r.leavePay + r.otPay + r.nightDiffPay - r.lateDeduction + otherEarnings);

  // Contributions are computed on a monthly-equivalent of this run's basic pay
  // and split evenly across the month's runs, so a weekly-paid contractual pays
  // roughly the same monthly total as a monthly-paid employee on the same wage.
  const monthlyBasic = Math.max(0, (r.basicPay + r.leavePay - r.lateDeduction) * runsPerMonth);
  const per = (m: { ee: number; er: number }, on: boolean) =>
    on ? { ee: round2(m.ee / runsPerMonth), er: round2(m.er / runsPerMonth) } : { ee: 0, er: 0 };
  const sss = per(sssMonthly(monthlyBasic), group.deductSss);
  const ph = per(philhealthMonthly(monthlyBasic), group.deductPhilhealth);
  const hdmf = per(hdmfMonthly(monthlyBasic), group.deductHdmf);

  // Taxable = gross less non-taxable earnings and employee contributions.
  // Minimum wage earners are exempt on their compensation.
  const taxableIncome = round2(Math.max(0, grossPay - nonTaxableEarnings - sss.ee - ph.ee - hdmf.ee));
  const withholdingTax =
    group.withholdTax && !input.isMinimumWage ? round2(annualIncomeTax(taxableIncome * ppy) / ppy) : 0;

  const totalDeductions = round2(sss.ee + ph.ee + hdmf.ee + withholdingTax + otherDeductions);
  return {
    daysWorked: round2(daysWorked),
    ...r,
    leaveDays: round2(leaveDays),
    unpaidLeaveDays: round2(unpaidLeaveDays),
    otherEarnings: round2(otherEarnings),
    grossPay,
    sssEe: sss.ee,
    sssEr: sss.er,
    philhealthEe: ph.ee,
    philhealthEr: ph.er,
    hdmfEe: hdmf.ee,
    hdmfEr: hdmf.er,
    taxableIncome,
    withholdingTax,
    otherDeductions: round2(otherDeductions),
    totalDeductions,
    netPay: round2(grossPay - totalDeductions),
  };
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  REG: "Regular day",
  RD: "Rest day",
  SH: "Special holiday",
  RH: "Regular holiday",
};

export const FREQUENCY_LABEL: Record<PayFrequency, string> = {
  MONTHLY: "Monthly",
  SEMI_MONTHLY: "Semi-monthly",
  WEEKLY: "Weekly",
  DAILY: "Daily / custom",
};
