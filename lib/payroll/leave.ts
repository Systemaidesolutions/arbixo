// Pure leave helpers shared by the server and the filing form: counting leave
// dates, accrued credits, eligibility, and the Philippine statutory defaults
// every company starts with. No DB access.

export type LeaveCreditBasis = "ANNUAL" | "PER_EVENT" | "UNLIMITED";
export type LeaveAccrual = "UPFRONT" | "MONTHLY";
export type LeaveEligibility = "ANY" | "FEMALE" | "MALE";
export type EmploymentType = "REGULAR" | "PROBATIONARY" | "CONTRACTUAL" | "PROJECT_BASED" | "CASUAL";
export type LeaveDate = { date: string; days: number };

export type LeaveTypeRules = {
  code: string;
  name: string;
  isPaid: boolean;
  creditBasis: LeaveCreditBasis;
  days: number;
  accrual: LeaveAccrual;
  countCalendarDays: boolean;
  allowHalfDay: boolean;
  allowNegative: boolean;
  minServiceMonths: number;
  eligibility: LeaveEligibility;
  soloParentOnly: boolean;
  employmentTypes: EmploymentType[];
  maxCarryOver: number;
  convertibleToCash: boolean;
  soloParentExtraDays: number; // added to the per-filing limit for solo parents (maternity +15)
  maxFilings: number | null; // lifetime filings (paternity: first 4 deliveries)
  maxDaysPerYear: number | null; // e.g. special leave for women: 60 days a year
};

export type LeaveTypeDefault = LeaveTypeRules & { description: string; legalBasis: string | null; isStatutory: boolean; isActive: boolean };

const base = {
  isPaid: true, creditBasis: "ANNUAL", accrual: "UPFRONT", countCalendarDays: false, allowHalfDay: true, allowNegative: false,
  minServiceMonths: 0, eligibility: "ANY", soloParentOnly: false, employmentTypes: [] as EmploymentType[], maxCarryOver: 0, convertibleToCash: false,
  soloParentExtraDays: 0, maxFilings: null, maxDaysPerYear: null,
  isStatutory: true, isActive: true, legalBasis: null,
} as const;

/**
 * Starter leave types for a new company: the PH statutory leaves as described
 * in the DOLE Handbook on Workers' Statutory Monetary Benefits (2024), plus
 * common company-policy ones. All editable.
 */
export const PH_LEAVE_DEFAULTS: LeaveTypeDefault[] = [
  { ...base, code: "SIL", name: "Service Incentive Leave", days: 5, minServiceMonths: 12, convertibleToCash: true, legalBasis: "Labor Code Art. 95",
    description: "5 days with pay a year after 1 year of service (continuous or broken), for sick, vacation or other purposes. Unused days are commuted to cash at year end or on separation, at the daily rate on the date of commutation. Not required for those already given at least 5 days VL with pay, or in establishments regularly employing fewer than 10." },
  { ...base, code: "VL", name: "Vacation Leave", days: 5, isStatutory: false, employmentTypes: ["REGULAR"], maxCarryOver: 5, convertibleToCash: true,
    description: "Company policy. Set the yearly credits, carry-over and who gets it. At least 5 days with pay counts as compliance with SIL." },
  { ...base, code: "SL", name: "Sick Leave", days: 5, isStatutory: false, employmentTypes: ["REGULAR"], maxCarryOver: 5,
    description: "Company policy. Set the yearly credits, carry-over and who gets it." },
  { ...base, code: "ML", name: "Maternity Leave", creditBasis: "PER_EVENT", days: 105, soloParentExtraDays: 15, countCalendarDays: true, allowHalfDay: false, eligibility: "FEMALE", legalBasis: "RA 11210",
    description: "105 days with full pay for every pregnancy regardless of frequency (120 for solo parents; 60 days for miscarriage or emergency termination). Needs at least 3 SSS monthly contributions in the 12 months before the semester of childbirth, and notice to the employer. The employer pays the salary differential over the SSS benefit. An extra 30 days without pay may be taken after live childbirth: file it as Leave Without Pay. Up to 7 days may be allocated to the father (ML-ALLOC)." },
  { ...base, code: "ML-ALLOC", name: "Allocated Maternity Leave (father)", creditBasis: "PER_EVENT", days: 7, allowHalfDay: false, eligibility: "MALE", legalBasis: "RA 11210 Sec. 6",
    description: "Up to 7 days of the mother's maternity leave allocated to the child's father, married or not. Over and above paternity leave." },
  { ...base, code: "PL", name: "Paternity Leave", creditBasis: "PER_EVENT", days: 7, maxFilings: 4, allowHalfDay: false, eligibility: "MALE", legalBasis: "RA 8187",
    description: "7 days with full pay for a married male employee cohabiting with his wife, for each of the first 4 deliveries (incl. miscarriage). Applies whatever the employment status. Not convertible to cash." },
  { ...base, code: "SPL", name: "Parental Leave for Solo Parents", days: 7, minServiceMonths: 6, soloParentOnly: true, legalBasis: "RA 8972 as amended by RA 11861",
    description: "Up to 7 working days with pay every year for a solo parent with at least 6 months of service (continuous or broken) and a valid Solo Parent ID. Forfeitable, non-cumulative, and not convertible to cash unless agreed. Emergency leave doesn't count as compliance." },
  { ...base, code: "VAWC", name: "Leave for VAWC Victims", creditBasis: "PER_EVENT", days: 10, eligibility: "FEMALE", legalBasis: "RA 9262 Sec. 43",
    description: "Up to 10 days with full pay (basic salary and mandatory allowances) for a woman employee who is a victim of VAWC, on a certification that an action is pending. Extended when a protection order requires it. Not cumulative or convertible to cash." },
  { ...base, code: "SLW", name: "Special Leave for Women", creditBasis: "PER_EVENT", days: 60, maxDaysPerYear: 60, countCalendarDays: true, allowHalfDay: false, eligibility: "FEMALE", minServiceMonths: 6, legalBasis: "RA 9710 (Magna Carta of Women)",
    description: "Up to 2 months (60 calendar days a year) with full pay after surgery for a gynecological disorder, for women with at least 6 months of continuous aggregate service in the last 12 months. The physician's certified recuperation period controls. Not cumulative or convertible to cash." },
  { ...base, code: "LWOP", name: "Leave Without Pay", isPaid: false, creditBasis: "UNLIMITED", days: 0, isStatutory: false,
    description: "Approved absence without pay. Deducted from monthly-paid employees; daily-rate employees aren't paid for the day. Leave without pay on the workday before a regular holiday forfeits that holiday's pay." },
];

const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/**
 * The dates a filing covers. Working-day leave types skip the company's rest
 * weekdays; calendar-day types (maternity) count every date. A single-date
 * half-day filing counts 0.5.
 */
export function leaveDatesFor(start: string, end: string, opts: { restWeekdays: number[]; countCalendarDays: boolean; halfDay?: boolean }): LeaveDate[] {
  if (!start || !end || end < start) return [];
  const out: LeaveDate[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  // Capped at ~a year: long enough for maternity (105 days) with room to spare.
  for (let i = 0; d <= last && i < 400; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (opts.countCalendarDays || !opts.restWeekdays.includes(dow(iso))) out.push({ date: iso, days: 1 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  if (opts.halfDay && out.length === 1) out[0].days = 0.5;
  return out;
}

export const sumDays = (dates: LeaveDate[]) => Math.round(dates.reduce((s, d) => s + (Number(d.days) || 0), 0) * 100) / 100;

/** Leave days per calendar year (a filing can cross into the next year). */
export function daysByYear(dates: LeaveDate[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const d of dates) { const y = Number(d.date.slice(0, 4)); m.set(y, (m.get(y) ?? 0) + (Number(d.days) || 0)); }
  return m;
}

/** Granted credits earned so far: all of it up front, or 1/12 per month through `throughMonth` (1–12) for monthly accrual. */
export function accruedCredits(granted: number, accrual: LeaveAccrual, throughMonth: number): number {
  if (accrual === "UPFRONT") return granted;
  return Math.round(((granted * Math.min(12, Math.max(0, throughMonth))) / 12) * 100) / 100;
}

/** Whole months from hire date to `asOf` (both YYYY-MM-DD). */
export function serviceMonths(hireDate: string | null, asOf: string): number {
  if (!hireDate) return 0;
  const [hy, hm, hd] = hireDate.split("-").map(Number);
  const [ay, am, ad] = asOf.split("-").map(Number);
  return Math.max(0, (ay - hy) * 12 + (am - hm) - (ad < hd ? 1 : 0));
}

export type EmployeeFacts = { sex: "MALE" | "FEMALE" | null; isSoloParent: boolean; employmentType: EmploymentType | null; hireDate: string | null };

/** Why an employee can't take this leave type as of `asOf`, or null if eligible. */
export function eligibilityProblem(t: LeaveTypeRules, e: EmployeeFacts, asOf: string): string | null {
  if (t.eligibility !== "ANY" && e.sex !== t.eligibility) {
    return e.sex ? `${t.name} is for ${t.eligibility === "FEMALE" ? "female" : "male"} employees only.` : `Set the employee's sex in Payroll employees to file ${t.name}.`;
  }
  if (t.soloParentOnly && !e.isSoloParent) return `${t.name} is for employees marked as solo parents.`;
  if (t.employmentTypes.length && (!e.employmentType || !t.employmentTypes.includes(e.employmentType))) return `${t.name} doesn't apply to this employment type.`;
  if (t.minServiceMonths > 0) {
    if (!e.hireDate) return `${t.name} needs ${t.minServiceMonths} months of service. Set the employee's hire date first.`;
    const m = serviceMonths(e.hireDate, asOf);
    if (m < t.minServiceMonths) return `${t.name} needs ${t.minServiceMonths} months of service (has ${m}).`;
  }
  return null;
}

export const CREDIT_BASIS_LABEL: Record<LeaveCreditBasis, string> = { ANNUAL: "Yearly credits", PER_EVENT: "Per filing", UNLIMITED: "No limit" };

/** Approved leave a payroll run line pulled in, one entry per date. */
export type RunLeave = { date: string; days: number; paid: boolean; code: string; leaveRequestId: string };
