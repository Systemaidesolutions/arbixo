// Pure payroll computation — no DB access, so it runs the same on the server
// (when saving/posting a run) and in the browser (live preview while encoding).
//
// Pay rules follow the DOLE "Handbook on Workers' Statutory Monetary Benefits"
// (2024 edition): holiday pay (Art. 94), premium pay (Arts. 91-93), overtime
// (Art. 87), night shift differential (Art. 86), 13th-month pay (PD 851) and
// the withholding-tax exemptions it summarizes. Multipliers are company
// settings (PayrollSetup) defaulting to the handbook's minimum rates.
//
// Statutory contribution tables are the 2025 rates. They're kept here as
// plain functions so a future rate change is a one-file edit.

export type PayBasis = "MONTHLY" | "DAILY";
export type PayFrequency = "MONTHLY" | "SEMI_MONTHLY" | "WEEKLY" | "DAILY";

/**
 * Day type of a date in the run. RD suffix = falls on the rest day.
 *   REG ordinary day · RD rest day · SH special (non-working) day ·
 *   DSH double special day · RH regular holiday · DH double regular holiday.
 * A special (working) day is paid as an ordinary day, so it's REG.
 */
export type DayType = "REG" | "RD" | "SH" | "SHRD" | "DSH" | "DSHRD" | "RH" | "RHRD" | "DH" | "DHRD";
export const DAY_TYPES: DayType[] = ["REG", "RD", "SH", "SHRD", "DSH", "DSHRD", "RH", "RHRD", "DH", "DHRD"];

export type PayrollRules = {
  workDaysPerYear: number;
  hoursPerDay: number;
  otMultiplier: number; // OT on an ordinary day (125%)
  premiumOtMultiplier: number; // OT on a rest day / special day / holiday (130% of that day's rate)
  restDayMultiplier: number;
  specialHolidayMultiplier: number;
  specialRestDayMultiplier: number;
  doubleSpecialMultiplier: number;
  doubleSpecialRestDayMultiplier: number;
  regularHolidayMultiplier: number;
  regularHolidayRestDayMultiplier: number;
  doubleHolidayMultiplier: number;
  doubleHolidayRestDayMultiplier: number;
  nightDiffRate: number;
  payUnworkedRegularHoliday: boolean;
  holidayRequiresPriorPresence: boolean;
  monthlyIncludesRestDays: boolean;
  monthlyIncludesSpecialDays: boolean;
};

export const DEFAULT_RULES: PayrollRules = {
  workDaysPerYear: 313,
  hoursPerDay: 8,
  otMultiplier: 1.25,
  premiumOtMultiplier: 1.3,
  restDayMultiplier: 1.3,
  specialHolidayMultiplier: 1.3,
  specialRestDayMultiplier: 1.5,
  doubleSpecialMultiplier: 1.5,
  doubleSpecialRestDayMultiplier: 1.95,
  regularHolidayMultiplier: 2,
  regularHolidayRestDayMultiplier: 2.6,
  doubleHolidayMultiplier: 3,
  doubleHolidayRestDayMultiplier: 3.9,
  nightDiffRate: 0.1,
  payUnworkedRegularHoliday: true,
  holidayRequiresPriorPresence: true,
  monthlyIncludesRestDays: false,
  monthlyIncludesSpecialDays: true,
};

export type ContributionTiming = "EVERY_RUN" | "FIRST_RUN" | "LAST_RUN";

export type GroupRules = {
  frequency: PayFrequency;
  /** Weekly / semi-monthly groups: which run of the month takes SSS/PhilHealth/Pag-IBIG (default every run). */
  contributionTiming?: ContributionTiming;
  deductSss: boolean;
  deductPhilhealth: boolean;
  deductHdmf: boolean;
  withholdTax: boolean;
};

export type Adjustment = {
  payItemId: string; code: string; name: string; kind: "EARNING" | "DEDUCTION"; taxable: boolean;
  isOtherBenefit?: boolean; amount: number;
};

/** Work on a specific date, priced at that date's day type. */
export type DayHours = { days?: number; ot?: number; nd?: number; ndOt?: number };

export type LineInput = {
  payBasis: PayBasis;
  rate: number;
  isMinimumWage: boolean;
  attendance?: Record<string, number> | null; // DAILY: days worked per ISO date
  absentDays?: number; // MONTHLY
  lateMinutes?: number;
  otHours?: number; // ordinary-day OT (dated OT goes in dayHours)
  nightDiffHours?: number; // ordinary-day night hours
  dayHours?: Record<string, DayHours> | null;
  adjustments?: Adjustment[];
  // Approved leave in the period, one entry per date (see lib/payroll/leave.ts).
  leaves?: { date: string; days: number; paid: boolean }[] | null;
  restDates?: string[] | null; // this employee's rest days; null = use the run's day types as is
  leaveConversionDays?: number; // unused leave paid in cash this run
  benefitsExemptRemaining?: number; // what's left of the yearly 13th-month/benefits exemption
  // Per-employee government deduction overrides; null/undefined = pay group's switch.
  govDeductions?: GovDeductions | null;
};

export type GovDeductions = { sss?: boolean | null; philhealth?: boolean | null; hdmf?: boolean | null; tax?: boolean | null };

/** The employee's own switch when set, otherwise the pay group's. */
export function effectiveGov(group: { deductSss: boolean; deductPhilhealth: boolean; deductHdmf: boolean; withholdTax: boolean }, own?: GovDeductions | null) {
  return {
    sss: own?.sss ?? group.deductSss,
    philhealth: own?.philhealth ?? group.deductPhilhealth,
    hdmf: own?.hdmf ?? group.deductHdmf,
    tax: own?.tax ?? group.withholdTax,
  };
}

export type RunContext = {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  payDate?: string; // YYYY-MM-DD; decides the first/last run of the month for contribution timing
  dayTypes?: Record<string, DayType> | null; // holidays (and legacy run-wide rest days)
  rules: PayrollRules;
  group: GroupRules;
};

export type LineResult = {
  daysWorked: number;
  basicPay: number;
  holidayPay: number;
  premiumPay: number;
  leaveDays: number;
  leavePay: number;
  unpaidLeaveDays: number;
  leaveConversionDays: number;
  leaveConversionPay: number;
  otPay: number;
  nightDiffPay: number;
  lateDeduction: number;
  otherEarnings: number;
  exemptBenefits: number;
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

/**
 * How this run takes the monthly government contributions: "split" = its share
 * (monthly ÷ runs a month), "full" = the whole monthly amount, "none" = nothing.
 * Only weekly and semi-monthly groups can pick the first or last run of the
 * month; the run is placed by its pay date (weekly: pay date in the month's
 * first 7 days / last 7 days; semi-monthly: 1st–15th / 16th on).
 */
export function contributionShare(frequency: PayFrequency, timing: ContributionTiming | undefined, payDate: string | undefined): "split" | "full" | "none" {
  if (!timing || timing === "EVERY_RUN" || !payDate || (frequency !== "WEEKLY" && frequency !== "SEMI_MONTHLY")) return "split";
  const [y, m, d] = payDate.split("-").map(Number);
  if (!y || !m || !d) return "split";
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = frequency === "WEEKLY" ? d <= 7 : d <= 15;
  const last = frequency === "WEEKLY" ? d + 7 > daysInMonth : d > 15;
  return (timing === "FIRST_RUN" ? first : last) ? "full" : "none";
}

// ---------------- Day types ----------------

export const isRestDayType = (t: DayType) => t === "RD" || t.endsWith("RD");

const WITHOUT_REST: Record<DayType, DayType> = { REG: "REG", RD: "REG", SH: "SH", SHRD: "SH", DSH: "DSH", DSHRD: "DSH", RH: "RH", RHRD: "RH", DH: "DH", DHRD: "DH" };
const WITH_REST: Record<DayType, DayType> = { REG: "RD", RD: "RD", SH: "SHRD", SHRD: "SHRD", DSH: "DSHRD", DSHRD: "DSHRD", RH: "RHRD", RHRD: "RHRD", DH: "DHRD", DHRD: "DHRD" };
/** The holiday part of a day type (rest day removed). */
export const holidayPart = (t: DayType): DayType => WITHOUT_REST[t];
/** Same holiday, falling on the rest day. */
export const onRestDay = (t: DayType): DayType => WITH_REST[t];

/** One employee's day types: the run's holidays combined with that employee's own rest days. */
export function employeeDayTypes(runTypes: Record<string, DayType> | null | undefined, restDates: string[]): Record<string, DayType> {
  const out: Record<string, DayType> = {};
  for (const [d, t] of Object.entries(runTypes ?? {})) if (holidayPart(t) !== "REG") out[d] = holidayPart(t);
  for (const d of restDates) out[d] = onRestDay(out[d] ?? "REG");
  return out;
}

/** Dates in the period falling on the given weekdays (0 = Sunday). */
export function restDatesFor(periodStart: string, periodEnd: string, weekdays: number[]): string[] {
  return periodDates(periodStart, periodEnd).filter((d) => weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()));
}
export const isSpecialDayType = (t: DayType) => t === "SH" || t === "SHRD" || t === "DSH" || t === "DSHRD";
/** Regular holidays on this date: 0, 1, or 2 for a double holiday. */
export const regularHolidayCount = (t: DayType) => (t === "DH" || t === "DHRD" ? 2 : t === "RH" || t === "RHRD" ? 1 : 0);

/** Pay for work on this day type, as a multiple of the daily rate (first 8 hours). */
export function dayMultiplier(t: DayType, r: PayrollRules): number {
  switch (t) {
    case "REG": return 1;
    case "RD": return r.restDayMultiplier;
    case "SH": return r.specialHolidayMultiplier;
    case "SHRD": return r.specialRestDayMultiplier;
    case "DSH": return r.doubleSpecialMultiplier;
    case "DSHRD": return r.doubleSpecialRestDayMultiplier;
    case "RH": return r.regularHolidayMultiplier;
    case "RHRD": return r.regularHolidayRestDayMultiplier;
    case "DH": return r.doubleHolidayMultiplier;
    case "DHRD": return r.doubleHolidayRestDayMultiplier;
  }
}

/** OT hour = hourly rate × day multiplier × (125% on ordinary days, 130% otherwise). */
export const otFactor = (t: DayType, r: PayrollRules) => (t === "REG" ? r.otMultiplier : r.premiumOtMultiplier);

/**
 * How many days' pay a monthly salary already includes for this date, so
 * work on it earns only the rest. Regular holidays are always paid (twice on
 * a double holiday); special and rest days depend on the salary factor.
 */
export function monthlyCoveredDays(t: DayType, r: PayrollRules): number {
  const rh = regularHolidayCount(t);
  if (rh) return rh;
  if (t === "REG") return 1;
  if (isSpecialDayType(t) && r.monthlyIncludesSpecialDays) return 1;
  if (isRestDayType(t) && r.monthlyIncludesRestDays) return 1;
  return 0;
}

// ---------------- Statutory contributions (monthly amounts) ----------------

/** SSS 2025: 15% of the Monthly Salary Credit (EE 5%, ER 10%), MSC 5,000–35,000 in 500 steps, plus employer EC (₱10 below ₱14,750 compensation, ₱30 from there). */
export function sssMonthly(monthlyComp: number): { ee: number; er: number } {
  if (monthlyComp <= 0) return { ee: 0, er: 0 };
  const msc = Math.min(35000, Math.max(5000, Math.floor((monthlyComp + 250) / 500) * 500));
  const ec = msc < 15000 ? 10 : 30;
  return { ee: round2(msc * 0.05), er: round2(msc * 0.1 + ec) };
}

/** PhilHealth 2024–2025: 5% of monthly basic salary (floor 10,000, ceiling 100,000), shared equally. */
export function philhealthMonthly(monthlyBasic: number): { ee: number; er: number } {
  if (monthlyBasic <= 0) return { ee: 0, er: 0 };
  const base = Math.min(100000, Math.max(10000, monthlyBasic));
  const half = round2((base * 0.05) / 2);
  return { ee: half, er: half };
}

/** Pag-IBIG (Circular 460): EE 1% (fund salary ≤1,500) or 2%, ER 2%, on a fund salary capped at 10,000. */
export function hdmfMonthly(monthlyComp: number): { ee: number; er: number } {
  if (monthlyComp <= 0) return { ee: 0, er: 0 };
  const base = Math.min(10000, monthlyComp);
  return { ee: round2(base * (monthlyComp <= 1500 ? 0.01 : 0.02)), er: round2(base * 0.02) };
}

/** Annual income tax on compensation (TRAIN table, 2023 onward). ₱250,000 and below is exempt. */
export function annualIncomeTax(annualTaxable: number): number {
  const t = annualTaxable;
  if (t <= 250000) return 0;
  if (t <= 400000) return (t - 250000) * 0.15;
  if (t <= 800000) return 22500 + (t - 400000) * 0.2;
  if (t <= 2000000) return 102500 + (t - 800000) * 0.25;
  if (t <= 8000000) return 402500 + (t - 2000000) * 0.3;
  return 2202500 + (t - 8000000) * 0.35;
}

export function dailyRateOf(payBasis: PayBasis, rate: number, rules: PayrollRules): number {
  return payBasis === "DAILY" ? rate : (rate * 12) / (rules.workDaysPerYear || 313);
}

// ---------------- Line computation ----------------

export function computeLine(input: LineInput, ctx: RunContext): LineResult {
  const { rules, group } = ctx;
  const dates = periodDates(ctx.periodStart, ctx.periodEnd);
  const ppy = periodsPerYear(group.frequency, dates.length);
  const runsPerMonth = ppy / 12;
  const types = input.restDates ? employeeDayTypes(ctx.dayTypes, input.restDates) : (ctx.dayTypes ?? {});
  const typeOf = (d: string): DayType => types[d] ?? "REG";

  const dailyRate = dailyRateOf(input.payBasis, input.rate, rules);
  const hourlyRate = dailyRate / (rules.hoursPerDay || 8);

  const leaves = input.leaves ?? [];
  const leaveDays = leaves.filter((l) => l.paid).reduce((s, l) => s + (Number(l.days) || 0), 0);
  const unpaidLeaveDays = leaves.filter((l) => !l.paid).reduce((s, l) => s + (Number(l.days) || 0), 0);
  const paidLeave = new Map<string, number>();
  for (const l of leaves) if (l.paid) paidLeave.set(l.date, (paidLeave.get(l.date) ?? 0) + (Number(l.days) || 0));
  const dayHours = input.dayHours ?? {};

  let daysWorked = 0;
  let basicPay = 0;
  let holidayPay = 0;
  let premiumPay = 0;
  let leavePay = 0;

  if (input.payBasis === "DAILY") {
    // Daily-paid: paid for days actually worked and unworked regular holidays.
    const att = input.attendance ?? {};
    const worked = (d: string) => Math.max(0, Number(att[d]) || 0);

    // Holiday pay needs presence (or paid leave) on the workday before the
    // holiday. Rest days and unworked special days in between are skipped; for
    // successive holidays the earlier one decides (handbook, Holiday Pay E–F).
    // Before the period starts we can't tell, so assume present.
    const eligible = new Map<string, boolean>();
    const holidayEligible = (idx: number): boolean => {
      if (!rules.holidayRequiresPriorPresence) return true;
      const key = dates[idx];
      if (eligible.has(key)) return eligible.get(key)!;
      let ok = true;
      for (let j = idx - 1; j >= 0; j--) {
        const d = dates[j];
        const t = typeOf(d);
        if (worked(d) > 0 || (paidLeave.get(d) ?? 0) > 0) { ok = true; break; }
        if (regularHolidayCount(t)) { ok = holidayEligible(j); break; }
        if (isRestDayType(t) || isSpecialDayType(t)) continue; // non-work day: look further back
        ok = false; // absent on an ordinary workday
        break;
      }
      eligible.set(key, ok);
      return ok;
    };

    dates.forEach((date, idx) => {
      const days = worked(date);
      const type = typeOf(date);
      const onLeave = paidLeave.get(date) ?? 0;
      if (days > 0) {
        // Worked: 100% to basic, the rest of the day's multiplier to premium.
        daysWorked += days;
        basicPay += dailyRate * days;
        premiumPay += dailyRate * days * (dayMultiplier(type, rules) - 1);
      } else if (regularHolidayCount(type) && rules.payUnworkedRegularHoliday && holidayEligible(idx)) {
        // Unworked regular holiday: 100% (200% on a double holiday).
        holidayPay += dailyRate * regularHolidayCount(type);
      } else if (onLeave > 0 && !isRestDayType(type) && !regularHolidayCount(type)) {
        // Paid leave on a workday or special day.
        leavePay += dailyRate * Math.min(1, onLeave);
      }
    });
  } else {
    // Monthly-paid: fixed salary split evenly across the month's runs, less
    // absences and unpaid leave. Paid leave and regular holidays are already
    // covered by the salary.
    const absent = Math.max(0, input.absentDays ?? 0) + unpaidLeaveDays;
    basicPay = input.rate / runsPerMonth - dailyRate * absent;
    daysWorked = Math.max(0, rules.workDaysPerYear / ppy - absent - leaveDays);
  }

  // Work on rest days / special days / holidays entered by date. Daily-rate
  // staff get the day itself from the grid; monthly-paid staff get the part
  // of the day's rate their salary doesn't already include.
  let otPay = hourlyRate * rules.otMultiplier * Math.max(0, input.otHours ?? 0);
  let nightDiffPay = hourlyRate * rules.nightDiffRate * Math.max(0, input.nightDiffHours ?? 0);
  for (const [date, h] of Object.entries(dayHours)) {
    if (date < ctx.periodStart || date > ctx.periodEnd) continue;
    const type = typeOf(date);
    const mult = dayMultiplier(type, rules);
    const ot = Math.max(0, Number(h.ot) || 0);
    const nd = Math.max(0, Number(h.nd) || 0);
    const ndOt = Math.max(0, Number(h.ndOt) || 0);
    if (input.payBasis === "MONTHLY") {
      const days = Math.min(1, Math.max(0, Number(h.days) || 0));
      premiumPay += dailyRate * days * Math.max(0, mult - monthlyCoveredDays(type, rules));
    }
    otPay += hourlyRate * mult * otFactor(type, rules) * ot;
    // Night shift: +10% of the hour's rate, including OT hours at night.
    nightDiffPay += hourlyRate * mult * rules.nightDiffRate * nd + hourlyRate * mult * otFactor(type, rules) * rules.nightDiffRate * ndOt;
  }

  const lateDeduction = (hourlyRate / 60) * Math.max(0, input.lateMinutes ?? 0);
  const leaveConversionDays = Math.max(0, input.leaveConversionDays ?? 0);
  // Commuted leave is paid at the salary rate on the date of commutation (SIL rules).
  const leaveConversionPay = dailyRate * leaveConversionDays;

  const adjustments = input.adjustments ?? [];
  const earnings = adjustments.filter((a) => a.kind === "EARNING");
  const amt = (a: Adjustment) => Number(a.amount) || 0;
  const otherEarnings = earnings.reduce((s, a) => s + amt(a), 0);
  const benefits = earnings.filter((a) => a.isOtherBenefit).reduce((s, a) => s + amt(a), 0);
  const nonTaxableEarnings = earnings.filter((a) => !a.isOtherBenefit && !a.taxable).reduce((s, a) => s + amt(a), 0);
  const taxableExtras = earnings.filter((a) => !a.isOtherBenefit && a.taxable).reduce((s, a) => s + amt(a), 0);
  const otherDeductions = adjustments.filter((a) => a.kind === "DEDUCTION").reduce((s, a) => s + amt(a), 0);

  const r = {
    basicPay: round2(Math.max(0, basicPay)),
    holidayPay: round2(holidayPay),
    premiumPay: round2(premiumPay),
    leavePay: round2(leavePay),
    leaveConversionPay: round2(leaveConversionPay),
    otPay: round2(otPay),
    nightDiffPay: round2(nightDiffPay),
    lateDeduction: round2(lateDeduction),
  };
  const grossPay = round2(r.basicPay + r.holidayPay + r.premiumPay + r.leavePay + r.leaveConversionPay + r.otPay + r.nightDiffPay - r.lateDeduction + otherEarnings);

  // Contributions on monthly equivalents, split evenly across the month's runs:
  //   PhilHealth on basic salary; SSS on compensation and Pag-IBIG on fund
  //   salary (pay for services incl. OT/premiums/taxable allowances), both
  //   without 13th-month-type benefits, de minimis or commuted leave.
  const basic = r.basicPay + r.holidayPay + r.leavePay - r.lateDeduction;
  const compensation = basic + r.premiumPay + r.otPay + r.nightDiffPay + taxableExtras;
  // A weekly/semi-monthly group can take the whole month's amount on its first
  // or last run (computed from this run's pay as a monthly equivalent).
  const share = contributionShare(group.frequency, group.contributionTiming, ctx.payDate);
  const divisor = share === "full" ? 1 : runsPerMonth;
  const per = (m: { ee: number; er: number }, on: boolean) =>
    on && share !== "none" ? { ee: round2(m.ee / divisor), er: round2(m.er / divisor) } : { ee: 0, er: 0 };
  const gov = effectiveGov(group, input.govDeductions);
  const sss = per(sssMonthly(Math.max(0, compensation * runsPerMonth)), gov.sss);
  const ph = per(philhealthMonthly(Math.max(0, basic * runsPerMonth)), gov.philhealth);
  const hdmf = per(hdmfMonthly(Math.max(0, compensation * runsPerMonth)), gov.hdmf);

  // 13th-month-type benefits are tax-exempt up to the yearly cap (₱90,000).
  const exemptBenefits = round2(Math.min(benefits, Math.max(0, input.benefitsExemptRemaining ?? Infinity)));
  const benefitsExcess = benefits - exemptBenefits;

  // Taxable compensation: gross less non-taxable items and employee
  // contributions. A minimum wage earner is exempt on the minimum wage,
  // holiday, OT and night shift pay, but not on other taxable pay
  // (commissions, taxable allowances, benefits over the cap).
  const taxableIncome = round2(Math.max(0, input.isMinimumWage
    ? taxableExtras + benefitsExcess
    : grossPay - nonTaxableEarnings - exemptBenefits - r.leaveConversionPay - sss.ee - ph.ee - hdmf.ee));
  const withholdingTax = gov.tax ? round2(annualIncomeTax(taxableIncome * ppy) / ppy) : 0;

  const totalDeductions = round2(sss.ee + ph.ee + hdmf.ee + withholdingTax + otherDeductions);
  return {
    daysWorked: round2(daysWorked),
    ...r,
    leaveDays: round2(leaveDays),
    unpaidLeaveDays: round2(unpaidLeaveDays),
    leaveConversionDays: round2(leaveConversionDays),
    otherEarnings: round2(otherEarnings),
    exemptBenefits,
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

// ---------------- 13th-month pay (PD 851) ----------------

/**
 * Basic salary earned on a posted regular-run line, for the 13th-month base:
 * basic pay incl. paid leave, less late/undertime. Excludes OT, premiums,
 * night shift and holiday pay of daily-paid staff, commuted leave, and
 * allowances (handbook, 13th-month C).
 */
export const thirteenthMonthBase = (l: { basicPay: number; leavePay: number; lateDeduction: number }) =>
  Math.max(0, l.basicPay + l.leavePay - l.lateDeduction);

export type ThirteenthInput = {
  basis: number; // basic salary earned this calendar year
  alreadyPaid: number; // 13th-month already paid this year (e.g. a mid-year half)
  benefitsExemptRemaining: number;
  ytdTaxable: number; // taxable compensation already paid this year
  withholdTax: boolean;
};

/** 1/12 of the year's basic salary less what's been paid; tax only on the part above the exemption cap. */
export function computeThirteenth(i: ThirteenthInput) {
  const pay = round2(Math.max(0, i.basis / 12 - i.alreadyPaid));
  const exempt = round2(Math.min(pay, Math.max(0, i.benefitsExemptRemaining)));
  const taxable = round2(pay - exempt);
  // Tax on the excess = tax on (year-to-date + excess) less tax on year-to-date.
  const tax = i.withholdTax && taxable > 0 ? round2(annualIncomeTax(i.ytdTaxable + taxable) - annualIncomeTax(i.ytdTaxable)) : 0;
  return { pay, exempt, taxable, tax, net: round2(pay - tax) };
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  REG: "Ordinary day",
  RD: "Rest day",
  SH: "Special (non-working) day",
  SHRD: "Special day on rest day",
  DSH: "Double special day",
  DSHRD: "Double special day on rest day",
  RH: "Regular holiday",
  RHRD: "Regular holiday on rest day",
  DH: "Double regular holiday",
  DHRD: "Double regular holiday on rest day",
};

export const FREQUENCY_LABEL: Record<PayFrequency, string> = {
  MONTHLY: "Monthly",
  SEMI_MONTHLY: "Semi-monthly",
  WEEKLY: "Weekly",
  DAILY: "Daily / custom",
};
