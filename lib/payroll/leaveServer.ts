import { prisma } from "@/lib/prisma";
import type { EmploymentType, LeaveAccrual, LeaveCreditBasis, LeaveEligibility, LeaveType, Prisma } from "@prisma/client";
import { getOrCreateSetup, isoDate } from "./server";
import {
  PH_LEAVE_DEFAULTS, accruedCredits, daysByYear, eligibilityProblem, leaveDatesFor, sumDays,
  type EmployeeFacts, type LeaveDate, type LeaveTypeRules, type RunLeave,
} from "./leave";

// Leave types, credits and filings. Filings reserve credits while PENDING and
// use them once APPROVED; approved leave flows into draft payroll runs via
// leaveForRun().

export type LeaveResult = { status: number; error?: string; record?: unknown; created?: number };
const n = (v: unknown) => (v == null ? 0 : Number(v));
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

const BASES: LeaveCreditBasis[] = ["ANNUAL", "PER_EVENT", "UNLIMITED"];
const ACCRUALS: LeaveAccrual[] = ["UPFRONT", "MONTHLY"];
const ELIGIBILITY: LeaveEligibility[] = ["ANY", "FEMALE", "MALE"];
const EMPLOYMENT: EmploymentType[] = ["REGULAR", "PROBATIONARY", "CONTRACTUAL", "PROJECT_BASED", "CASUAL"];

/**
 * Seeds the PH statutory + common leave types, adds any default a company is
 * missing (matched by code), and fills statutory limits added later on rows
 * that still have none. Company edits are otherwise left alone.
 */
export async function ensureLeaveTypes(companyId: string) {
  const have = new Set((await prisma.leaveType.findMany({ where: { companyId }, select: { code: true } })).map((t) => t.code));
  const missing = PH_LEAVE_DEFAULTS.map((t, i) => ({ ...t, companyId, sortOrder: i })).filter((t) => !have.has(t.code));
  if (missing.length) await prisma.leaveType.createMany({ skipDuplicates: true, data: missing });
  if (have.size) {
    await prisma.leaveType.updateMany({ where: { companyId, code: "ML", isStatutory: true, soloParentExtraDays: 0 }, data: { soloParentExtraDays: 15 } });
    await prisma.leaveType.updateMany({ where: { companyId, code: "PL", isStatutory: true, maxFilings: null }, data: { maxFilings: 4 } });
    await prisma.leaveType.updateMany({ where: { companyId, code: "SLW", isStatutory: true, maxDaysPerYear: null }, data: { maxDaysPerYear: 60 } });
  }
}

export function toLeaveRules(t: LeaveType): LeaveTypeRules {
  return {
    code: t.code, name: t.name, isPaid: t.isPaid, creditBasis: t.creditBasis, days: n(t.days), accrual: t.accrual,
    countCalendarDays: t.countCalendarDays, allowHalfDay: t.allowHalfDay, allowNegative: t.allowNegative,
    minServiceMonths: t.minServiceMonths, eligibility: t.eligibility, soloParentOnly: t.soloParentOnly,
    employmentTypes: t.employmentTypes, maxCarryOver: n(t.maxCarryOver), convertibleToCash: t.convertibleToCash,
    soloParentExtraDays: n(t.soloParentExtraDays), maxFilings: t.maxFilings, maxDaysPerYear: t.maxDaysPerYear == null ? null : n(t.maxDaysPerYear),
  };
}

export async function saveLeaveType(companyId: string, id: string | null, raw: Record<string, unknown>): Promise<LeaveResult> {
  const data: Prisma.LeaveTypeUncheckedUpdateInput = {};
  if ("code" in raw || !id) { const c = clean(raw.code); if (!c) return { status: 400, error: "Code is required." }; data.code = c.toUpperCase(); }
  if ("name" in raw || !id) { const nm = clean(raw.name); if (!nm) return { status: 400, error: "Name is required." }; data.name = nm; }
  if ("description" in raw) data.description = clean(raw.description);
  if ("legalBasis" in raw) data.legalBasis = clean(raw.legalBasis);
  if ("creditBasis" in raw) { if (!BASES.includes(raw.creditBasis as LeaveCreditBasis)) return { status: 400, error: "Invalid credit basis." }; data.creditBasis = raw.creditBasis as LeaveCreditBasis; }
  if ("accrual" in raw) { if (!ACCRUALS.includes(raw.accrual as LeaveAccrual)) return { status: 400, error: "Invalid accrual." }; data.accrual = raw.accrual as LeaveAccrual; }
  if ("eligibility" in raw) { if (!ELIGIBILITY.includes(raw.eligibility as LeaveEligibility)) return { status: 400, error: "Invalid eligibility." }; data.eligibility = raw.eligibility as LeaveEligibility; }
  for (const f of ["days", "maxCarryOver", "soloParentExtraDays"] as const) {
    if (f in raw) { const v = Number(raw[f]); if (!Number.isFinite(v) || v < 0 || v > 366) return { status: 400, error: "Days must be between 0 and 366." }; data[f] = v; }
  }
  if ("maxFilings" in raw) {
    const v = raw.maxFilings === null || raw.maxFilings === "" ? null : Math.floor(Number(raw.maxFilings));
    if (v !== null && (!Number.isFinite(v) || v < 1 || v > 100)) return { status: 400, error: "Invalid max number of filings." };
    data.maxFilings = v;
  }
  if ("maxDaysPerYear" in raw) {
    const v = raw.maxDaysPerYear === null || raw.maxDaysPerYear === "" ? null : Number(raw.maxDaysPerYear);
    if (v !== null && (!Number.isFinite(v) || v <= 0 || v > 366)) return { status: 400, error: "Invalid max days per year." };
    data.maxDaysPerYear = v;
  }
  if ("minServiceMonths" in raw) { const v = Math.floor(Number(raw.minServiceMonths)); if (!Number.isFinite(v) || v < 0 || v > 600) return { status: 400, error: "Invalid months of service." }; data.minServiceMonths = v; }
  if ("employmentTypes" in raw) {
    const list = Array.isArray(raw.employmentTypes) ? (raw.employmentTypes as string[]) : [];
    if (list.some((e) => !EMPLOYMENT.includes(e as EmploymentType))) return { status: 400, error: "Invalid employment type." };
    data.employmentTypes = list as EmploymentType[];
  }
  for (const f of ["isPaid", "countCalendarDays", "allowHalfDay", "allowNegative", "soloParentOnly", "convertibleToCash", "isActive"] as const) {
    if (typeof raw[f] === "boolean") data[f] = raw[f] as boolean;
  }
  try {
    if (!id) {
      const sortOrder = (await prisma.leaveType.count({ where: { companyId } })) + 1;
      return { status: 200, record: await prisma.leaveType.create({ data: { ...(data as Prisma.LeaveTypeUncheckedCreateInput), companyId, sortOrder } }) };
    }
    if (!(await prisma.leaveType.findFirst({ where: { id, companyId } }))) return { status: 404, error: "Leave type not found." };
    return { status: 200, record: await prisma.leaveType.update({ where: { id }, data }) };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { status: 409, error: "A leave type with that code already exists." };
    throw e;
  }
}

async function employeeFacts(companyId: string, employeeId: string): Promise<EmployeeFacts | null> {
  const p = await prisma.payrollProfile.findFirst({ where: { companyId, employeeId } });
  if (!p) return null;
  return { sex: p.sex, isSoloParent: p.isSoloParent, employmentType: p.employmentType, hireDate: p.hireDate ? isoDate(p.hireDate) : null };
}

/** Days of this leave type the employee has filed (pending or approved) per year. */
async function usedByYear(employeeId: string, leaveTypeId: string, years: number[], excludeId?: string): Promise<Map<number, number>> {
  const reqs = await prisma.leaveRequest.findMany({
    where: {
      employeeId, leaveTypeId, status: { in: ["PENDING", "APPROVED"] }, ...(excludeId ? { id: { not: excludeId } } : {}),
      startDate: { lte: utc(`${Math.max(...years)}-12-31`) }, endDate: { gte: utc(`${Math.min(...years)}-01-01`) },
    },
    select: { dates: true },
  });
  const used = new Map<number, number>();
  for (const r of reqs) daysByYear(r.dates as LeaveDate[]).forEach((d, y) => used.set(y, (used.get(y) ?? 0) + d));
  return used;
}

/** Credits available for one year, before subtracting what's been used. */
async function creditTotal(employeeId: string, t: LeaveType, year: number, throughMonth: number): Promise<number> {
  const c = await prisma.leaveCredit.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: t.id, year } } });
  if (!c) return 0;
  return accruedCredits(n(c.granted), t.accrual, throughMonth) + n(c.carriedOver) + n(c.adjustment);
}

export type FileLeaveInput = {
  employeeId?: string; leaveTypeId?: string; startDate?: string; endDate?: string; halfDay?: boolean;
  dates?: LeaveDate[]; reason?: string | null; approve?: boolean;
};

/** Files a leave (PENDING, or APPROVED right away when `approve` is set) after eligibility, overlap and balance checks. */
export async function fileLeave(companyId: string, userId: string, raw: FileLeaveInput): Promise<LeaveResult> {
  if (!raw.employeeId || !raw.leaveTypeId || !isDate(raw.startDate) || !isDate(raw.endDate)) return { status: 400, error: "Employee, leave type and dates are required." };
  if (raw.endDate < raw.startDate) return { status: 400, error: "End date is before start date." };
  const t = await prisma.leaveType.findFirst({ where: { id: raw.leaveTypeId, companyId } });
  if (!t || !t.isActive) return { status: 404, error: "Leave type not found." };
  const facts = await employeeFacts(companyId, raw.employeeId);
  if (!facts) return { status: 400, error: "Set up this employee's pay details under Payroll employees first." };
  const rules = toLeaveRules(t);

  const problem = eligibilityProblem(rules, facts, raw.startDate);
  if (problem) return { status: 400, error: problem };

  const setup = await getOrCreateSetup(companyId);
  // Skip the employee's own fixed rest days (company rest days when flexible or not set).
  const prof = await prisma.payrollProfile.findUnique({ where: { employeeId: raw.employeeId }, select: { restDayMode: true, restWeekdays: true } });
  const restWeekdays = prof?.restDayMode === "FIXED" && prof.restWeekdays.length ? prof.restWeekdays : setup.restWeekdays;
  const allowed = leaveDatesFor(raw.startDate, raw.endDate, { restWeekdays, countCalendarDays: t.countCalendarDays, halfDay: t.allowHalfDay && raw.halfDay });
  // The form may trim dates or mark half days; only keep dates inside the range.
  let dates = allowed;
  if (Array.isArray(raw.dates)) {
    const ok = new Set(allowed.map((d) => d.date));
    dates = raw.dates
      .filter((d) => ok.has(d.date))
      .map((d) => ({ date: d.date, days: t.allowHalfDay && Number(d.days) === 0.5 ? 0.5 : 1 }));
  }
  const days = sumDays(dates);
  if (days <= 0) return { status: 400, error: "The selected dates don't include any leave days." };

  // Overlap with the employee's other open filings.
  const others = await prisma.leaveRequest.findMany({
    where: { companyId, employeeId: raw.employeeId, kind: "FILING", status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: utc(raw.endDate) }, endDate: { gte: utc(raw.startDate) } },
    include: { leaveType: { select: { code: true } } },
  });
  const mine = new Set(dates.map((d) => d.date));
  for (const o of others) {
    const clash = (o.dates as LeaveDate[]).find((d) => mine.has(d.date));
    if (clash) return { status: 409, error: `Already on ${o.leaveType.code} leave on ${clash.date}.` };
  }

  if (t.maxFilings) {
    const filed = await prisma.leaveRequest.count({ where: { employeeId: raw.employeeId, leaveTypeId: t.id, kind: "FILING", status: { in: ["PENDING", "APPROVED"] } } });
    if (filed >= t.maxFilings) return { status: 400, error: `${t.name} can be filed at most ${t.maxFilings} times (already ${filed}).` };
  }
  if (t.maxDaysPerYear != null) {
    const perYear = daysByYear(dates);
    const used = await usedByYear(raw.employeeId, t.id, [...perYear.keys()]);
    for (const [year, want] of perYear) {
      const left = n(t.maxDaysPerYear) - (used.get(year) ?? 0);
      if (want > left + 1e-9) return { status: 400, error: `${t.name} is limited to ${n(t.maxDaysPerYear)} days a year; ${Math.max(0, left)} left for ${year}.` };
    }
  }
  if (!t.allowNegative) {
    const perFiling = n(t.days) + (facts.isSoloParent ? n(t.soloParentExtraDays) : 0);
    if (t.creditBasis === "PER_EVENT" && days > perFiling) return { status: 400, error: `${t.name} allows up to ${perFiling} days per filing.` };
    if (t.creditBasis === "ANNUAL") {
      const perYear = daysByYear(dates);
      const used = await usedByYear(raw.employeeId, t.id, [...perYear.keys()]);
      for (const [year, want] of perYear) {
        const lastMonth = Math.max(...dates.filter((d) => d.date.startsWith(String(year))).map((d) => Number(d.date.slice(5, 7))));
        const available = (await creditTotal(raw.employeeId, t, year, lastMonth)) - (used.get(year) ?? 0);
        if (want > available + 1e-9) return { status: 400, error: `Not enough ${t.code} credits for ${year}: ${Math.max(0, Math.round(available * 100) / 100)} day(s) available, ${want} requested.` };
      }
    }
  }

  const approve = raw.approve === true;
  const record = await prisma.leaveRequest.create({
    data: {
      companyId, employeeId: raw.employeeId, leaveTypeId: t.id, startDate: utc(dates[0].date), endDate: utc(dates[dates.length - 1].date),
      dates, days, isPaid: t.isPaid, reason: clean(raw.reason), status: approve ? "APPROVED" : "PENDING", filedById: userId,
      ...(approve ? { decidedById: userId, decidedAt: new Date() } : {}),
    },
  });
  return { status: 200, record };
}

/** Dates of this filing already paid out in a posted payroll run. */
async function postedDates(companyId: string, employeeId: string, dates: LeaveDate[]): Promise<string[]> {
  if (dates.length === 0) return [];
  const runs = await prisma.payrollRun.findMany({
    where: { companyId, status: "POSTED", periodStart: { lte: utc(dates[dates.length - 1].date) }, periodEnd: { gte: utc(dates[0].date) }, lines: { some: { employeeId } } },
    select: { periodStart: true, periodEnd: true },
  });
  return dates.map((d) => d.date).filter((d) => runs.some((r) => isoDate(r.periodStart) <= d && d <= isoDate(r.periodEnd)));
}

export async function decideLeave(companyId: string, userId: string, id: string, action: unknown, note: unknown): Promise<LeaveResult> {
  const req = await prisma.leaveRequest.findFirst({ where: { id, companyId } });
  if (!req) return { status: 404, error: "Leave filing not found." };
  const decided = { decidedById: userId, decidedAt: new Date(), decisionNote: clean(note) };
  if (action === "approve" || action === "reject") {
    if (req.status !== "PENDING") return { status: 400, error: "Only pending filings can be approved or rejected." };
    return { status: 200, record: await prisma.leaveRequest.update({ where: { id }, data: { status: action === "approve" ? "APPROVED" : "REJECTED", ...decided } }) };
  }
  if (action === "cancel") {
    if (req.status !== "PENDING" && req.status !== "APPROVED") return { status: 400, error: "This filing is already closed." };
    if (req.status === "APPROVED") {
      // A conversion is paid on its startDate; a filing on each leave date.
      const paidOn = req.kind === "CONVERSION" ? [{ date: isoDate(req.startDate), days: n(req.days) }] : (req.dates as LeaveDate[]);
      const paid = await postedDates(companyId, req.employeeId, paidOn);
      if (paid.length) return { status: 400, error: `Can't cancel: ${paid.join(", ")} already went through a posted payroll run.` };
    }
    return { status: 200, record: await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED", ...decided } }) };
  }
  return { status: 400, error: "Unknown action." };
}

/**
 * Grants a year's credits for every ANNUAL leave type to each eligible active
 * employee (eligibility judged as of Dec 31). Rows that already exist are left
 * alone, so manual edits survive. Carry-over = last year's unused days, capped
 * at the leave type's max carry-over.
 */
export async function grantCredits(companyId: string, year: number): Promise<LeaveResult> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { status: 400, error: "Invalid year." };
  const [types, profiles] = await Promise.all([
    prisma.leaveType.findMany({ where: { companyId, isActive: true, creditBasis: "ANNUAL" } }),
    prisma.payrollProfile.findMany({ where: { companyId, isActive: true, employee: { isActive: true } } }),
  ]);
  let created = 0;
  for (const t of types) {
    const rules = toLeaveRules(t);
    for (const p of profiles) {
      const facts: EmployeeFacts = { sex: p.sex, isSoloParent: p.isSoloParent, employmentType: p.employmentType, hireDate: p.hireDate ? isoDate(p.hireDate) : null };
      if (eligibilityProblem(rules, facts, `${year}-12-31`)) continue;
      const exists = await prisma.leaveCredit.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId: p.employeeId, leaveTypeId: t.id, year } } });
      if (exists) continue;
      let carriedOver = 0;
      if (n(t.maxCarryOver) > 0) {
        const prev = await creditTotal(p.employeeId, t, year - 1, 12);
        const used = (await usedByYear(p.employeeId, t.id, [year - 1])).get(year - 1) ?? 0;
        carriedOver = Math.min(n(t.maxCarryOver), Math.max(0, prev - used));
      }
      await prisma.leaveCredit.create({ data: { companyId, employeeId: p.employeeId, leaveTypeId: t.id, year, granted: n(t.days), carriedOver } });
      created++;
    }
  }
  return { status: 200, created };
}

/** Manual edit of one employee's credits for a year (creates the row if needed). */
export async function saveCredit(companyId: string, raw: Record<string, unknown>): Promise<LeaveResult> {
  const year = Number(raw.year);
  if (!raw.employeeId || !raw.leaveTypeId || !Number.isInteger(year)) return { status: 400, error: "Employee, leave type and year are required." };
  const [emp, t] = await Promise.all([
    prisma.employee.count({ where: { id: String(raw.employeeId), companyId } }),
    prisma.leaveType.count({ where: { id: String(raw.leaveTypeId), companyId } }),
  ]);
  if (!emp || !t) return { status: 404, error: "Employee or leave type not found." };
  const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0; };
  const data = { granted: Math.max(0, num(raw.granted)), carriedOver: Math.max(0, num(raw.carriedOver)), adjustment: num(raw.adjustment), remarks: clean(raw.remarks) };
  const employeeId = String(raw.employeeId), leaveTypeId = String(raw.leaveTypeId);
  const record = await prisma.leaveCredit.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    create: { companyId, employeeId, leaveTypeId, year, ...data },
    update: data,
  });
  return { status: 200, record };
}

/** Approved leave in a payroll period, per employee, one entry per date inside the period. */
export async function leaveForRun(companyId: string, employeeIds: string[], start: string, end: string): Promise<Map<string, RunLeave[]>> {
  const out = new Map<string, RunLeave[]>();
  if (employeeIds.length === 0) return out;
  const reqs = await prisma.leaveRequest.findMany({
    where: { companyId, employeeId: { in: employeeIds }, kind: "FILING", status: "APPROVED", startDate: { lte: utc(end) }, endDate: { gte: utc(start) } },
    include: { leaveType: { select: { code: true } } },
    orderBy: { startDate: "asc" },
  });
  for (const r of reqs) {
    const list = out.get(r.employeeId) ?? [];
    for (const d of r.dates as LeaveDate[]) {
      if (d.date >= start && d.date <= end) list.push({ date: d.date, days: Number(d.days) || 0, paid: r.isPaid, code: r.leaveType.code, leaveRequestId: r.id });
    }
    out.set(r.employeeId, list);
  }
  return out;
}

/** Unused leave converted to cash and due in this period, in days per employee. */
export async function conversionsForRun(companyId: string, employeeIds: string[], start: string, end: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (employeeIds.length === 0) return out;
  const rows = await prisma.leaveRequest.findMany({
    where: { companyId, employeeId: { in: employeeIds }, kind: "CONVERSION", status: "APPROVED", startDate: { gte: utc(start), lte: utc(end) } },
    select: { employeeId: true, days: true },
  });
  for (const r of rows) out.set(r.employeeId, (out.get(r.employeeId) ?? 0) + n(r.days));
  return out;
}

/**
 * Commutes each employee's unused credits of a cash-convertible leave type for
 * a year (SIL: at year end or on separation). Creates an approved conversion
 * per employee that the draft run covering `payOn` pays at the daily rate.
 */
export async function convertLeave(companyId: string, userId: string, raw: { leaveTypeId?: string; year?: number; payOn?: string; employeeIds?: string[] }): Promise<LeaveResult> {
  const year = Number(raw.year);
  if (!raw.leaveTypeId || !Number.isInteger(year) || !isDate(raw.payOn)) return { status: 400, error: "Leave type, year and pay date are required." };
  const t = await prisma.leaveType.findFirst({ where: { id: raw.leaveTypeId, companyId } });
  if (!t) return { status: 404, error: "Leave type not found." };
  if (!t.convertibleToCash || t.creditBasis !== "ANNUAL") return { status: 400, error: `${t.name} isn't convertible to cash.` };
  const credits = await prisma.leaveCredit.findMany({
    where: { companyId, leaveTypeId: t.id, year, ...(raw.employeeIds?.length ? { employeeId: { in: raw.employeeIds } } : {}) },
  });
  let created = 0;
  for (const c of credits) {
    const used = (await usedByYear(c.employeeId, t.id, [year])).get(year) ?? 0;
    const left = Math.round(((await creditTotal(c.employeeId, t, year, 12)) - used) * 100) / 100;
    if (left <= 0) continue;
    await prisma.leaveRequest.create({
      data: {
        companyId, employeeId: c.employeeId, leaveTypeId: t.id, kind: "CONVERSION", startDate: utc(raw.payOn), endDate: utc(raw.payOn),
        dates: [{ date: `${year}-12-31`, days: left }], days: left, isPaid: true, status: "APPROVED",
        reason: `Unused ${t.code} ${year} converted to cash`, filedById: userId, decidedById: userId, decidedAt: new Date(),
      },
    });
    created++;
  }
  return { status: 200, created };
}

export type PayslipLeave = {
  /** Approved leave falling in the pay period, one row per leave type. */
  taken: { code: string; name: string; paid: boolean; days: number; dates: string[] }[];
  /** Yearly-credit leave types as of the period end: earned so far, used to date, remaining. */
  balances: { code: string; name: string; earned: number; used: number; remaining: number }[];
};

/** Leave details for payslips: what was taken in the period and what's left for the year. */
export async function payslipLeave(companyId: string, employeeIds: string[], start: string, end: string): Promise<Map<string, PayslipLeave>> {
  const out = new Map<string, PayslipLeave>();
  if (employeeIds.length === 0) return out;
  const year = Number(end.slice(0, 4));
  const throughMonth = Number(end.slice(5, 7));
  const [types, credits, reqs] = await Promise.all([
    prisma.leaveType.findMany({ where: { companyId }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.leaveCredit.findMany({ where: { companyId, year, employeeId: { in: employeeIds } } }),
    prisma.leaveRequest.findMany({
      where: { companyId, employeeId: { in: employeeIds }, kind: "FILING", status: "APPROVED", startDate: { lte: utc(end) }, endDate: { gte: utc(`${year}-01-01`) } },
      select: { employeeId: true, leaveTypeId: true, isPaid: true, dates: true },
    }),
  ]);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  for (const id of employeeIds) {
    const mine = reqs.filter((r) => r.employeeId === id);
    const taken: PayslipLeave["taken"] = [];
    const usedByType = new Map<string, number>();
    for (const r of mine) {
      for (const d of r.dates as LeaveDate[]) {
        const days = Number(d.days) || 0;
        if (d.date.slice(0, 4) === String(year) && d.date <= end) usedByType.set(r.leaveTypeId, (usedByType.get(r.leaveTypeId) ?? 0) + days);
        if (d.date < start || d.date > end) continue;
        const t = types.find((x) => x.id === r.leaveTypeId);
        let row = taken.find((x) => x.code === (t?.code ?? "?") && x.paid === r.isPaid);
        if (!row) { row = { code: t?.code ?? "?", name: t?.name ?? "Leave", paid: r.isPaid, days: 0, dates: [] }; taken.push(row); }
        row.days = r2(row.days + days);
        row.dates.push(d.date);
      }
    }
    taken.forEach((x) => x.dates.sort());
    const balances: PayslipLeave["balances"] = [];
    for (const t of types.filter((x) => x.creditBasis === "ANNUAL")) {
      const c = credits.find((x) => x.employeeId === id && x.leaveTypeId === t.id);
      const used = r2(usedByType.get(t.id) ?? 0);
      if (!c && !used) continue;
      const earned = r2(c ? accruedCredits(n(c.granted), t.accrual, throughMonth) + n(c.carriedOver) + n(c.adjustment) : 0);
      balances.push({ code: t.code, name: t.name, earned, used, remaining: r2(earned - used) });
    }
    out.set(id, { taken, balances });
  }
  return out;
}
