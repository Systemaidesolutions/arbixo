import { prisma } from "@/lib/prisma";
import { effectiveCompanyId, resolvePoster } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { postDocument, type LedgerLineInput } from "@/lib/ledgerPosting";
import type { PayrollSetup, PayGroup, Prisma } from "@prisma/client";
import { computeLine, periodDates, type Adjustment, type DayType, type GroupRules, type PayrollRules, type RunContext } from "./compute";

export type PayrollAuth =
  | { ok: true; companyId: string; userId: string }
  | { ok: false; status: number; error: string };

/** Payroll writes need posting rights on the caller's active company. */
export async function payrollAuth(need: "canPost" | "canCancel" = "canPost"): Promise<PayrollAuth> {
  const companyId = await effectiveCompanyId();
  if (!companyId) return { ok: false, status: 403, error: "No company selected." };
  const auth = await resolvePoster(companyId, need);
  if (!auth.ok) return auth;
  return { ok: true, companyId, userId: auth.user.id };
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
    restDayMultiplier: n(s.restDayMultiplier),
    specialHolidayMultiplier: n(s.specialHolidayMultiplier),
    regularHolidayMultiplier: n(s.regularHolidayMultiplier),
    nightDiffRate: n(s.nightDiffRate),
    payUnworkedRegularHoliday: s.payUnworkedRegularHoliday,
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
    return it ? [{ payItemId: it.id, code: it.code, name: it.name, kind: it.kind, taxable: it.taxable, amount: Math.abs(Number(a.amount)) }] : [];
  });
}

async function nextRunNo(companyId: string, payDate: Date): Promise<string> {
  const prefix = `PR-${payDate.getUTCFullYear()}-`;
  const last = await prisma.payrollRun.findFirst({ where: { companyId, runNo: { startsWith: prefix } }, orderBy: { runNo: "desc" }, select: { runNo: true } });
  const seq = last ? parseInt(last.runNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export type CreateRunInput = { payGroupId?: string; periodStart?: string; periodEnd?: string; payDate?: string; locationId?: string | null; remarks?: string | null };

/** Creates a draft run with one line per active employee in the pay group (and branch, if given), carrying their recurring items. */
export async function createRun(companyId: string, userId: string, raw: CreateRunInput) {
  if (!raw.payGroupId || !raw.periodStart || !raw.periodEnd || !raw.payDate) return { status: 400, error: "Pay group, period and pay date are required." };
  if (raw.periodEnd < raw.periodStart) return { status: 400, error: "Period end is before period start." };
  if (periodDates(raw.periodStart, raw.periodEnd).length > 31) return { status: 400, error: "A payroll period can't be longer than 31 days." };
  const group = await prisma.payGroup.findFirst({ where: { id: raw.payGroupId, companyId } });
  if (!group) return { status: 404, error: "Pay group not found." };

  const profiles = await prisma.payrollProfile.findMany({
    where: { companyId, payGroupId: group.id, isActive: true, employee: { isActive: true }, ...(raw.locationId ? { locationId: raw.locationId } : {}) },
  });
  const payDate = new Date(`${raw.payDate}T00:00:00Z`);
  const run = await prisma.payrollRun.create({
    data: {
      companyId,
      runNo: await nextRunNo(companyId, payDate),
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
          adjustments: (p.recurring ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      },
    },
  });
  await recomputeRun(companyId, run.id);
  return { status: 200, run };
}

export type LinePatch = {
  employeeId: string;
  attendance?: Record<string, number> | null;
  absentDays?: number;
  lateMinutes?: number;
  otHours?: number;
  nightDiffHours?: number;
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

/** Recomputes every line of a draft run from its inputs and refreshes the run totals. */
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

  const totals = { gross: 0, ded: 0, net: 0, er: 0 };
  setAuditSuppressed(true);
  try {
    for (const line of run.lines) {
      const adjustments = await resolveAdjustments(companyId, line.adjustments);
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
          adjustments,
        },
        ctx
      );
      await prisma.payrollRunLine.update({ where: { id: line.id }, data: r });
      totals.gross += r.grossPay;
      totals.ded += r.totalDeductions;
      totals.net += r.netPay;
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
  const missing = required.filter(([k]) => !setup[k]).map(([, label]) => label);
  if (missing.length) return { status: 400, error: `Set these accounts in Payroll setup first: ${missing.join(", ")}.` };

  const payItems = await prisma.payItem.findMany({ where: { companyId } });
  const debit = new Map<string, number>();
  const credit = new Map<string, number>();
  const add = (m: Map<string, number>, acct: string, amt: number) => amt && m.set(acct, (m.get(acct) ?? 0) + amt);
  const s = setup as Record<string, unknown>;
  const acct = (k: string) => s[k] as string;

  for (const l of run.lines) {
    // Earnings: base pay on the salaries account, pay items on their own account when set.
    add(debit, acct("salariesExpenseAccountId"), n(l.basicPay) + n(l.premiumPay) + n(l.otPay) + n(l.nightDiffPay) - n(l.lateDeduction));
    for (const a of (Array.isArray(l.adjustments) ? l.adjustments : []) as { payItemId: string; amount: number }[]) {
      const it = payItems.find((p) => p.id === a.payItemId);
      if (!it) continue;
      const amt = Math.abs(Number(a.amount) || 0);
      if (it.kind === "EARNING") add(debit, it.accountId ?? acct("salariesExpenseAccountId"), amt);
      else add(credit, it.accountId ?? acct("otherDeductionsAccountId"), amt);
    }
    add(debit, acct("contributionsExpenseAccountId"), n(l.sssEr) + n(l.philhealthEr) + n(l.hdmfEr));
    add(credit, acct("sssPayableAccountId"), n(l.sssEe) + n(l.sssEr));
    add(credit, acct("philhealthPayableAccountId"), n(l.philhealthEe) + n(l.philhealthEr));
    add(credit, acct("hdmfPayableAccountId"), n(l.hdmfEe) + n(l.hdmfEr));
    add(credit, acct("withholdingTaxPayableAccountId"), n(l.withholdingTax));
  }

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const description = `Payroll ${run.runNo} — ${run.payGroup.name}, ${isoDate(run.periodStart)} to ${isoDate(run.periodEnd)}`;
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
    if (sal) sal.debitAmount = r2((sal.debitAmount ?? 0) - diff);
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
  });
  await prisma.payrollRun.update({ where: { id: runId }, data: { status: "POSTED", postedAt: new Date(), postedById: userId } });
  return { status: 200, ok: true };
}
