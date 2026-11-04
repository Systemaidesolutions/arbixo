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
};

export type LeaveTypeDefault = LeaveTypeRules & { description: string; legalBasis: string | null; isStatutory: boolean; isActive: boolean };

const base = {
  isPaid: true, creditBasis: "ANNUAL", accrual: "UPFRONT", countCalendarDays: false, allowHalfDay: true, allowNegative: false,
  minServiceMonths: 0, eligibility: "ANY", soloParentOnly: false, employmentTypes: [] as EmploymentType[], maxCarryOver: 0, convertibleToCash: false,
  isStatutory: true, isActive: true, legalBasis: null,
} as const;

/** Starter leave types for a new company: the PH statutory leaves plus common company-policy ones. All editable. */
export const PH_LEAVE_DEFAULTS: LeaveTypeDefault[] = [
  { ...base, code: "SIL", name: "Service Incentive Leave", days: 5, minServiceMonths: 12, convertibleToCash: true, legalBasis: "Labor Code Art. 95",
    description: "5 days with pay a year after at least 1 year of service. Unused days are convertible to cash at year end. Not required if company VL/SL already gives at least 5 days." },
  { ...base, code: "VL", name: "Vacation Leave", days: 5, isStatutory: false, employmentTypes: ["REGULAR"], maxCarryOver: 5, convertibleToCash: true,
    description: "Company policy. Set the yearly credits, carry-over and who gets it." },
  { ...base, code: "SL", name: "Sick Leave", days: 5, isStatutory: false, employmentTypes: ["REGULAR"], maxCarryOver: 5,
    description: "Company policy. Set the yearly credits, carry-over and who gets it." },
  { ...base, code: "ML", name: "Maternity Leave", creditBasis: "PER_EVENT", days: 105, countCalendarDays: true, allowHalfDay: false, eligibility: "FEMALE", legalBasis: "RA 11210",
    description: "105 calendar days with full pay per pregnancy (60 days for miscarriage or emergency termination; +15 days for solo parents). The SSS maternity benefit reimburses part of the pay; the employer pays the salary differential." },
  { ...base, code: "PL", name: "Paternity Leave", creditBasis: "PER_EVENT", days: 7, allowHalfDay: false, eligibility: "MALE", legalBasis: "RA 8187",
    description: "7 working days with full pay for a married male employee, for each of the first 4 deliveries of his legitimate spouse." },
  { ...base, code: "SPL", name: "Solo Parent Leave", days: 7, minServiceMonths: 6, soloParentOnly: true, legalBasis: "RA 8972 as amended by RA 11861",
    description: "7 working days with pay a year for solo parents with at least 6 months of service. Not convertible to cash." },
  { ...base, code: "VAWC", name: "VAWC Leave", creditBasis: "PER_EVENT", days: 10, eligibility: "FEMALE", legalBasis: "RA 9262 Sec. 43",
    description: "Up to 10 days with pay for women employees who are victims of violence, to attend to medical and legal concerns. Extendable when a protection order requires it." },
  { ...base, code: "SLW", name: "Special Leave for Women", creditBasis: "PER_EVENT", days: 60, countCalendarDays: true, allowHalfDay: false, eligibility: "FEMALE", minServiceMonths: 6, legalBasis: "RA 9710 (Magna Carta of Women)",
    description: "Up to 2 months with full pay after surgery for a gynecological disorder, for women with at least 6 months of service in the last 12 months." },
  { ...base, code: "LWOP", name: "Leave Without Pay", isPaid: false, creditBasis: "UNLIMITED", days: 0, isStatutory: false,
    description: "Approved absence without pay. Deducted from monthly-paid employees; daily-rate employees simply aren't paid for the day." },
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
