import { prisma } from "@/lib/prisma";
import { effectiveCompanyId, getCurrentUserRecord, resolvePoster } from "@/lib/currentUser";
import { resolveActiveCompanyApps } from "@/lib/userCompanyAccess";
import { setAuditSuppressed } from "@/lib/auditContext";
import { postDocument, type LedgerLineInput } from "@/lib/ledgerPosting";
import type { PayrollSetup, PayGroup, Prisma } from "@prisma/client";
import {
  computeLine, computeThirteenth, periodDates, restDatesFor, round2, thirteenthMonthBase,
  type Adjustment, type DayHours, type DayType, type GroupRules, type PayrollRules, type RunContext,
} from "./compute";
import { conversionsForRun, leaveForRun } from "./leaveServer";
import { claimReimbursementsForRun, markRunReimbursementsPaid } from "./reimbursementServer";

export type PayrollAuth =
  | { ok: true; companyId: string; userId: string; isAdmin: boolean }
  | { ok: false; status: number; error: string };

/** Payroll writes need posting rights on the caller's active company. */
export async function payrollAuth(need: "canPost" | "canCancel" = "canPost"): Promise<PayrollAuth> {
  const me = await getCurrentUserRecord();
  if (me && !(await resolveActiveCompanyApps(me)).includes("payroll")) return { ok: false, status: 403, error: "You don't have access to ARbixo Payroll in this company. Ask your administrator." };
  const companyId = await effectiveCompanyId();
  if (!companyId) return { ok: false, status: 403, error: "No company selected." };
  const auth = await resolvePoster(companyId, need);
  if (!auth.ok) return auth;
  return { ok: true, companyId, userId: auth.user.id, isAdmin: auth.user.role === "ADMIN" };
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const n = (v: unknown) => (v == null ? 0 : Number(v));

/** The company's PayrollSetup, created with Labor Code defaults on first use. New companies also get starter pay groups and pay items. */
export async function getOrCreateSetup(companyId: string): Promise<PayrollSetup> {
  const existing = await prisma.payrollSetup.findUnique({ where: { companyId } });
  if (existing) return existing;
  const setup = await prisma.payrollSetup.create({ data: { companyId } });
  if ((await prisma.payGroup.count({ where: { companyId } })) === 0) {
    await prisma.payGroup.createMany({
      data: [
        { companyId, code: "REG-SM", name: "Regular staff (semi-monthly)", frequency: "SEMI_MONTHLY" },
        { companyId, code: "CON-WK", name: "Contractuals (weekly, daily rate)", frequency: "WEEKLY", withholdTax: false },
      ],
    });
  }
  if ((await prisma.payItem.count({ where: { companyId } })) === 0) {
    await prisma.payItem.createMany({
      data: [
        { companyId, code: "ALLOW", name: "Allowance (de minimis)", kind: "EARNING", taxable: false },
        { companyId, code: "MEAL", name: "Meal allowance", kind: "EARNING", taxable: false },
        { companyId, code: "COMM", name: "Commission", kind: "EARNING", taxable: true },
        { companyId, code: "ADJ+", name: "Salary adjustment", kind: "EARNING", taxable: true },
        { companyId, code: "CA", name: "Cash advance", kind: "DEDUCTION" },
        { companyId, code: "SSSLN", name: "SSS loan", kind: "DEDUCTION" },
        { companyId, code: "HDMFLN", name: "Pag-IBIG loan", kind: "DEDUCTION" },
        { companyId, code: "ADJ-", name: "Other deduction", kind: "DEDUCTION" },
      ],
    });
  }
  return setup;
}

export function toRules(s: PayrollSetup): PayrollRules {
  return {
    workDaysPerYear: s.workDaysPerYear,
    hoursPerDay: n(s.hoursPerDay),
    otMultiplier: n(s.otMultiplier),
    premiumOtMultiplier: n(s.premiumOtMultiplier),
    restDayMultiplier: n(s.restDayMultiplier),
    specialHolidayMultiplier: n(s.specialHolidayMultiplier),
    specialRestDayMultiplier: n(s.specialRestDayMultiplier),
    doubleSpecialMultiplier: n(s.doubleSpecialMultiplier),
    doubleSpecialRestDayMultiplier: n(s.doubleSpecialRestDayMultiplier),
    regularHolidayMultiplier: n(s.regularHolidayMultiplier),
    regularHolidayRestDayMultiplier: n(s.regularHolidayRestDayMultiplier),
    doubleHolidayMultiplier: n(s.doubleHolidayMultiplier),
    doubleHolidayRestDayMultiplier: n(s.doubleHolidayRestDayMultiplier),
    nightDiffRate: n(s.nightDiffRate),
    payUnworkedRegularHoliday: s.payUnworkedRegularHoliday,
    holidayRequiresPriorPresence: s.holidayRequiresPriorPresence,
    monthlyIncludesRestDays: s.monthlyIncludesRestDays,
    monthlyIncludesSpecialDays: s.monthlyIncludesSpecialDays,
  };
}

export function toGroupRules(g: PayGroup): GroupRules {
  return { frequency: g.frequency, deductSss: g.deductSss, deductPhilhealth: g.deductPhilhealth, deductHdmf: g.deductHdmf, withholdTax: g.withholdTax };
}

/** Resolves stored [{ payItemId, amount }] against the company's pay items. */
async function resolveAdjustments(companyId: string, raw: unknown): Promise<Adjustment[]> {
  const list = Array.isArray(raw) ? (raw as { payItemId?: string; amount?: number }[]) : [];
  const wanted = list.filter((a) => a.payItemId && Number(a.amount));
  if (wanted.length === 0) return [];
  const items = await prisma.payItem.findMany({ where: { companyId, id: { in: wanted.map((a) => a.payItemId!) } } });
  return wanted.flatMap((a) => {
    const it = items.find((i) => i.id === a.payItemId);
    return it ? [{ payItemId: it.id, code: it.code, name: it.name, kind: it.kind, taxable: it.taxable, isOtherBenefit: it.isOtherBenefit, amount: Math.abs(Number(a.amount)) }] : [];
  });
}

async function nextRunNo(companyId: string, payDate: Date): Promise<string> {
  const prefix = `PR-${payDate.getUTCFullYear()}-`;
  const last = await prisma.payrollRun.findFirst({ where: { companyId, runNo: { startsWith: prefix } }, orderBy: { runNo: "desc" }, select: { runNo: true } });
  const seq = last ? parseInt(last.runNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export type CreateRunInput = {
  kind?: "REGULAR" | "THIRTEENTH_MONTH"; payGroupId?: string; periodStart?: string; periodEnd?: string; payDate?: string;
  year?: number; locationId?: string | null; remarks?: string | null;
};

/**
 * Creates a draft run. A regular run gets one line per active employee in the
 * pay group (and branch, if given), carrying their recurring items. A 13th-month
 * run covers the calendar year: everyone eligible in the group, plus anyone paid
 * in the group this year who has since left (they get it pro rata).
 */
export async function createRun(companyId: string, userId: string, raw: CreateRunInput) {
  const kind = raw.kind === "THIRTEENTH_MONTH" ? "THIRTEENTH_MONTH" : "REGULAR";
  if (kind === "THIRTEENTH_MONTH") {
    const year = Number(raw.year) || Number(raw.payDate?.slice(0, 4));
    if (!year) return { status: 400, error: "Year is required." };
    raw = { ...raw, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
  }
  if (!raw.payGroupId || !raw.periodStart || !raw.periodEnd || !raw.payDate) return { status: 400, error: "Pay group, period and pay date are required." };
  if (raw.periodEnd < raw.periodStart) return { status: 400, error: "Period end is before period start." };
  if (kind === "REGULAR" && periodDates(raw.periodStart, raw.periodEnd).length > 31) return { status: 400, error: "A payroll period can't be longer than 31 days." };
  const group = await prisma.payGroup.findFirst({ where: { id: raw.payGroupId, companyId } });
  if (!group) return { status: 404, error: "Pay group not found." };

  const branch = raw.locationId ? { locationId: raw.locationId } : {};
  let profiles = await prisma.payrollProfile.findMany({
    where: { companyId, payGroupId: group.id, isActive: true, employee: { isActive: true }, ...branch },
  });
  if (kind === "THIRTEENTH_MONTH") {
    const paidThisYear = await prisma.payrollRunLine.findMany({
      where: { run: { companyId, payGroupId: group.id, kind: "REGULAR", status: "POSTED", periodEnd: { gte: new Date(`${raw.periodStart}T00:00:00Z`), lte: new Date(`${raw.periodEnd}T00:00:00Z`) } } },
      select: { employeeId: true },
      distinct: ["employeeId"],
    });
    const extra = await prisma.payrollProfile.findMany({
      where: { companyId, employeeId: { in: paidThisYear.map((l) => l.employeeId), notIn: profiles.map((p) => p.employeeId) }, ...branch },
    });
    profiles = [...profiles, ...extra].filter((p) => p.thirteenthMonthEligible);
  }
  const payDate = new Date(`${raw.payDate}T00:00:00Z`);
  const run = await prisma.payrollRun.create({
    data: {
      companyId,
      runNo: await nextRunNo(companyId, payDate),
      kind,
      payGroupId: group.id,
      locationId: raw.locationId || null,
      periodStart: new Date(`${raw.periodStart}T00:00:00Z`),
      periodEnd: new Date(`${raw.periodEnd}T00:00:00Z`),
      payDate,
      remarks: raw.remarks?.trim() || null,
      createdById: userId,
      lines: {
        create: profiles.map((p) => ({
          employeeId: p.employeeId,
          payBasis: p.payBasis,
          rate: p.rate,
          adjustments: kind === "REGULAR" ? ((p.recurring ?? undefined) as Prisma.InputJsonValue | undefined) : undefined,
        })),
      },
    },
  });
  await recomputeRun(companyId, run.id);
  return { status: 200, run };
}

type RestProfile = { restDayMode: "FIXED" | "FLEXIBLE"; restWeekdays: number[] } | null | undefined;

/** An employee's rest days in a period from their schedule: fixed weekdays (or the company's), none when flexible. */
export function scheduledRestDates(p: RestProfile, companyRestWeekdays: number[], start: string, end: string): string[] {
  if (p?.restDayMode === "FLEXIBLE") return [];
  return restDatesFor(start, end, p?.restWeekdays?.length ? p.restWeekdays : companyRestWeekdays);
}

/** A run line's rest days: what's saved on the line, else the employee's schedule. */
export function lineRestDates(stored: unknown, p: RestProfile, companyRestWeekdays: number[], start: string, end: string): string[] {
  if (Array.isArray(stored)) return cleanRestDates(stored, start, end);
  return scheduledRestDates(p, companyRestWeekdays, start, end);
}

function cleanRestDates(raw: unknown[], start: string, end: string): string[] {
  return [...new Set(raw.map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= start && d <= end))].sort();
}

export type LinePatch = {
  employeeId: string;
  restDates?: string[] | null;
  attendance?: Record<string, number> | null;
  absentDays?: number;
  lateMinutes?: number;
  otHours?: number;
  nightDiffHours?: number;
  dayHours?: Record<string, DayHours> | null;
  adjustments?: { payItemId: string; amount: number }[];
};

/** Saves encoded inputs on a draft run (day types + per-employee lines), then recomputes every line. */
export async function saveRunInputs(companyId: string, runId: string, body: { dayTypes?: Record<string, DayType>; lines?: LinePatch[]; addEmployeeIds?: string[]; removeEmployeeIds?: string[]; remarks?: string | null }) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId } });
  if (!run) return { status: 404, error: "Payroll run not found." };
  if (run.status !== "DRAFT") return { status: 400, error: "Only draft runs can be edited." };

  setAuditSuppressed(true);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: runId },
        data: {
          ...(body.dayTypes ? { dayTypes: body.dayTypes } : {}),
          ...(body.remarks !== undefined ? { remarks: body.remarks?.trim() || null } : {}),
        },
      });
      if (body.removeEmployeeIds?.length) await tx.payrollRunLine.deleteMany({ where: { runId, employeeId: { in: body.removeEmployeeIds } } });
      if (body.addEmployeeIds?.length) {
        const profiles = await tx.payrollProfile.findMany({ where: { companyId, employeeId: { in: body.addEmployeeIds } } });
        for (const p of profiles) {
          await tx.payrollRunLine.upsert({
            where: { runId_employeeId: { runId, employeeId: p.employeeId } },
            create: { runId, employeeId: p.employeeId, payBasis: p.payBasis, rate: p.rate, adjustments: (p.recurring ?? undefined) as Prisma.InputJsonValue | undefined },
            update: {},
          });
        }
      }
      for (const l of body.lines ?? []) {
        const num = (v: unknown) => Math.max(0, Number(v) || 0);
        await tx.payrollRunLine.updateMany({
          where: { runId, employeeId: l.employeeId },
          data: {
            ...(l.attendance !== undefined ? { attendance: (l.attendance ?? undefined) as Prisma.InputJsonValue | undefined } : {}),
            ...(l.absentDays !== undefined ? { absentDays: num(l.absentDays) } : {}),
            ...(l.lateMinutes !== undefined ? { lateMinutes: num(l.lateMinutes) } : {}),
            ...(l.otHours !== undefined ? { otHours: num(l.otHours) } : {}),
            ...(l.nightDiffHours !== undefined ? { nightDiffHours: num(l.nightDiffHours) } : {}),
            ...(l.dayHours !== undefined ? { dayHours: cleanDayHours(l.dayHours) } : {}),
            ...(Array.isArray(l.restDates) ? { restDates: cleanRestDates(l.restDates, isoDate(run.periodStart), isoDate(run.periodEnd)) } : {}),
            ...(l.adjustments !== undefined ? { adjustments: l.adjustments.filter((a) => a.payItemId && Number(a.amount)) } : {}),
          },
        });
      }
    });
  } finally {
    setAuditSuppressed(false);
  }
  await recomputeRun(companyId, runId);
  return { status: 200, ok: true };
}

/** Keeps only dated entries with some hours/days, as plain non-negative numbers. */
function cleanDayHours(raw: unknown): Prisma.InputJsonValue {
  const out: Record<string, DayHours> = {};
  if (raw && typeof raw === "object") {
    for (const [date, h] of Object.entries(raw as Record<string, DayHours>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !h) continue;
      const v = (x: unknown, max: number) => Math.min(max, Math.max(0, Number(x) || 0));
      const e = { days: v(h.days, 1), ot: v(h.ot, 24), nd: v(h.nd, 24), ndOt: v(h.ndOt, 24) };
      if (e.days || e.ot || e.nd || e.ndOt) out[date] = e;
    }
  }
  return out;
}

/** Year-to-date figures from the employees' other posted runs, for the yearly benefits cap and 13th-month pay. */
async function yearToDate(companyId: string, employeeIds: string[], year: number, excludeRunId: string) {
  const lines = await prisma.payrollRunLine.findMany({
    where: {
      employeeId: { in: employeeIds },
      run: { companyId, status: "POSTED", id: { not: excludeRunId }, payDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } },
    },
    select: { employeeId: true, exemptBenefits: true, taxableIncome: true, thirteenthMonthPay: true, basicPay: true, leavePay: true, lateDeduction: true, run: { select: { kind: true, periodEnd: true } } },
  });
  const m = new Map<string, { exempt: number; taxable: number; paid13th: number; basis: number }>();
  for (const l of lines) {
    const t = m.get(l.employeeId) ?? { exempt: 0, taxable: 0, paid13th: 0, basis: 0 };
    t.exempt += n(l.exemptBenefits);
    t.taxable += n(l.taxableIncome);
    t.paid13th += n(l.thirteenthMonthPay);
    // Basic salary earned in the calendar year (by period end), for the 13th-month base.
    if (l.run.kind === "REGULAR" && l.run.periodEnd.getUTCFullYear() === year) {
      t.basis += thirteenthMonthBase({ basicPay: n(l.basicPay), leavePay: n(l.leavePay), lateDeduction: n(l.lateDeduction) });
    }
    m.set(l.employeeId, t);
  }
  return m;
}

/** Recomputes every line of a draft run from its inputs (plus approved leave in the period) and refreshes the run totals. */
export async function recomputeRun(companyId: string, runId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
    include: { payGroup: true, lines: { include: { employee: { include: { payrollProfile: true } } } } },
  });
  if (!run || run.status !== "DRAFT") return;
  const setup = await getOrCreateSetup(companyId);
  const ctx: RunContext = {
    periodStart: isoDate(run.periodStart),
    periodEnd: isoDate(run.periodEnd),
    dayTypes: (run.dayTypes ?? {}) as Record<string, DayType>,
    rules: toRules(setup),
    group: toGroupRules(run.payGroup),
  };

  const ids = run.lines.map((l) => l.employeeId);
  const year = run.payDate.getUTCFullYear();
  const cap = n(setup.benefitsExemptCap);
  const ytd = await yearToDate(companyId, ids, year, run.id);
  const totals = { gross: 0, ded: 0, net: 0, er: 0 };

  if (run.kind === "THIRTEENTH_MONTH") {
    setAuditSuppressed(true);
    try {
      for (const line of run.lines) {
        const y = ytd.get(line.employeeId) ?? { exempt: 0, taxable: 0, paid13th: 0, basis: 0 };
        const t = computeThirteenth({ basis: y.basis, alreadyPaid: y.paid13th, benefitsExemptRemaining: cap - y.exempt, ytdTaxable: y.taxable, withholdTax: run.payGroup.withholdTax });
        await prisma.payrollRunLine.update({
          where: { id: line.id },
          data: {
            thirteenthMonthBasis: round2(y.basis), thirteenthMonthPay: t.pay, exemptBenefits: t.exempt, taxableIncome: t.taxable,
            grossPay: t.pay, withholdingTax: t.tax, totalDeductions: t.tax, netPay: t.net,
          },
        });
        totals.gross += t.pay; totals.ded += t.tax; totals.net += t.net;
      }
      await prisma.payrollRun.update({ where: { id: runId }, data: { totalGross: totals.gross, totalDeductions: totals.ded, totalNet: totals.net, totalEmployer: 0 } });
    } finally {
      setAuditSuppressed(false);
    }
    return;
  }

  const leaves = await leaveForRun(companyId, ids, ctx.periodStart, ctx.periodEnd);
  const conversions = await conversionsForRun(companyId, ids, ctx.periodStart, ctx.periodEnd);
  // Approved reimbursements ride on the run: added to net pay only (not gross,
  // not taxable, no contributions).
  const reimbursements = await claimReimbursementsForRun(companyId, run.id, ids);
  setAuditSuppressed(true);
  try {
    for (const line of run.lines) {
      const adjustments = await resolveAdjustments(companyId, line.adjustments);
      const lineLeaves = leaves.get(line.employeeId) ?? [];
      const restDates = lineRestDates(line.restDates, line.employee.payrollProfile, setup.restWeekdays, ctx.periodStart, ctx.periodEnd);
      const r = computeLine(
        {
          payBasis: line.payBasis,
          rate: n(line.rate),
          isMinimumWage: line.employee.payrollProfile?.isMinimumWage ?? false,
          attendance: (line.attendance ?? {}) as Record<string, number>,
          absentDays: n(line.absentDays),
          lateMinutes: n(line.lateMinutes),
          otHours: n(line.otHours),
          nightDiffHours: n(line.nightDiffHours),
          dayHours: (line.dayHours ?? {}) as Record<string, DayHours>,
          restDates,
          adjustments,
          leaves: lineLeaves,
          leaveConversionDays: conversions.get(line.employeeId) ?? 0,
          benefitsExemptRemaining: cap - (ytd.get(line.employeeId)?.exempt ?? 0),
        },
        ctx
      );
      const reimb = reimbursements.get(line.employeeId) ?? 0;
      const netPay = round2(r.netPay + reimb);
      await prisma.payrollRunLine.update({ where: { id: line.id }, data: { ...r, reimbursements: reimb, netPay, leaves: lineLeaves, restDates } });
      totals.gross += r.grossPay;
      totals.ded += r.totalDeductions;
      totals.net += netPay;
      totals.er += r.sssEr + r.philhealthEr + r.hdmfEr;
    }
    await prisma.payrollRun.update({
      where: { id: runId },
      data: { totalGross: totals.gross, totalDeductions: totals.ded, totalNet: totals.net, totalEmployer: totals.er },
    });
  } finally {
    setAuditSuppressed(false);
  }
}

/**
 * Posts a draft run to the General Journal (document no. = run no.):
 *   Dr Salaries & wages (earnings by account)   Dr Employer contributions
 *   Cr SSS / PhilHealth / Pag-IBIG payable (EE+ER)   Cr Withholding tax payable
 *   Cr deduction accounts   Cr Net pay (one line per employee, tagged to them)
 */
export async function postRun(companyId: string, userId: string, runId: string) {
  await recomputeRun(companyId, runId);
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId }, include: { payGroup: true, lines: { include: { employee: true } } } });
  if (!run) return { status: 404, error: "Payroll run not found." };
  if (run.status !== "DRAFT") return { status: 400, error: "This run is already posted or cancelled." };
  if (run.lines.length === 0) return { status: 400, error: "The run has no employees." };

  const setup = await getOrCreateSetup(companyId);
  const thirteenth = run.kind === "THIRTEENTH_MONTH";
  const required: [keyof PayrollSetup, string][] = [
    ["salariesExpenseAccountId", "Salaries & wages expense"],
    ["contributionsExpenseAccountId", "Employer contributions expense"],
    ["sssPayableAccountId", "SSS payable"],
    ["philhealthPayableAccountId", "PhilHealth payable"],
    ["hdmfPayableAccountId", "Pag-IBIG payable"],
    ["withholdingTaxPayableAccountId", "Withholding tax payable"],
    ["otherDeductionsAccountId", "Other deductions"],
    ["netPayAccountId", "Net pay / salaries payable"],
  ];
  // A 13th-month run only touches salaries/13th-month expense, withholding tax and net pay.
  const needed = thirteenth ? required.filter(([k]) => ["salariesExpenseAccountId", "withholdingTaxPayableAccountId", "netPayAccountId"].includes(k)) : required;
  const missing = needed.filter(([k]) => !setup[k]).map(([, label]) => label);
  if (!thirteenth && !setup.reimbursementAccountId && run.lines.some((l) => n(l.reimbursements))) missing.push("Employee reimbursements");
  if (missing.length) return { status: 400, error: `Set these accounts in Payroll setup first: ${missing.join(", ")}.` };

  const payItems = await prisma.payItem.findMany({ where: { companyId } });
  const debit = new Map<string, number>();
  const credit = new Map<string, number>();
  const add = (m: Map<string, number>, acct: string, amt: number) => amt && m.set(acct, (m.get(acct) ?? 0) + amt);
  const s = setup as Record<string, unknown>;
  const acct = (k: string) => s[k] as string;

  for (const l of run.lines) {
    // Earnings: base pay on the salaries account, pay items on their own account when set.
    add(debit, acct("salariesExpenseAccountId"), n(l.basicPay) + n(l.holidayPay) + n(l.premiumPay) + n(l.leavePay) + n(l.leaveConversionPay) + n(l.otPay) + n(l.nightDiffPay) - n(l.lateDeduction));
    add(debit, setup.thirteenthMonthAccountId ?? acct("salariesExpenseAccountId"), n(l.thirteenthMonthPay));
    for (const a of (Array.isArray(l.adjustments) ? l.adjustments : []) as { payItemId: string; amount: number }[]) {
      const it = payItems.find((p) => p.id === a.payItemId);
      if (!it) continue;
      const amt = Math.abs(Number(a.amount) || 0);
      if (it.kind === "EARNING") add(debit, it.accountId ?? acct("salariesExpenseAccountId"), amt);
      else add(credit, it.accountId ?? acct("otherDeductionsAccountId"), amt);
    }
    add(debit, acct("contributionsExpenseAccountId"), n(l.sssEr) + n(l.philhealthEr) + n(l.hdmfEr));
    if (setup.reimbursementAccountId) add(debit, setup.reimbursementAccountId, n(l.reimbursements));
    add(credit, acct("sssPayableAccountId"), n(l.sssEe) + n(l.sssEr));
    add(credit, acct("philhealthPayableAccountId"), n(l.philhealthEe) + n(l.philhealthEr));
    add(credit, acct("hdmfPayableAccountId"), n(l.hdmfEe) + n(l.hdmfEr));
    add(credit, acct("withholdingTaxPayableAccountId"), n(l.withholdingTax));
  }

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const description = thirteenth
    ? `13th-month pay ${run.runNo} — ${run.payGroup.name}, ${run.periodStart.getUTCFullYear()}`
    : `Payroll ${run.runNo} — ${run.payGroup.name}, ${isoDate(run.periodStart)} to ${isoDate(run.periodEnd)}`;
  const lines: LedgerLineInput[] = [
    ...[...debit].filter(([, v]) => r2(v)).map(([accountId, v]) => ({ accountId, debitAmount: r2(v), description })),
    ...[...credit].filter(([, v]) => r2(v)).map(([accountId, v]) => ({ accountId, creditAmount: r2(v), description })),
    ...run.lines.filter((l) => n(l.netPay)).map((l) => ({
      accountId: acct("netPayAccountId"),
      creditAmount: n(l.netPay),
      description,
      lineDescription: `Net pay — ${l.employee.lastName}, ${l.employee.firstName}`,
      counterpartyType: "EMPLOYEE" as const,
      employeeId: l.employeeId,
    })),
  ];
  // Rounding: line amounts were rounded per employee, so fold any sub-peso
  // residue from the per-account grouping into the salaries line.
  const diff = r2(lines.reduce((t, l) => t + (l.debitAmount ?? 0) - (l.creditAmount ?? 0), 0));
  if (diff && Math.abs(diff) < 1) {
    const sal = lines.find((l) => l.accountId === acct("salariesExpenseAccountId") && l.debitAmount);
    const fix = sal ?? lines.find((l) => l.debitAmount);
    if (fix) fix.debitAmount = r2((fix.debitAmount ?? 0) - diff);
  }

  await postDocument({
    companyId,
    locationId: run.locationId,
    journalType: "GENERAL_JOURNAL",
    documentType: "JOURNAL",
    documentNo: run.runNo,
    postingDate: run.payDate,
    lines,
    createdById: userId,
    // Payroll is its own subscription, checked before posting
    // (lib/payroll/subscription.ts), not the accounting one.
    skipSubscriptionCheck: true,
  });
  await prisma.payrollRun.update({ where: { id: runId }, data: { status: "POSTED", postedAt: new Date(), postedById: userId } });
  if (!thirteenth) await markRunReimbursementsPaid(companyId, runId, run.runNo, userId);
  return { status: 200, ok: true };
}
