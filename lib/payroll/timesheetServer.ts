import { prisma } from "@/lib/prisma";
import { setAuditSuppressed } from "@/lib/auditContext";
import type { Prisma } from "@prisma/client";
import { employeeDayTypes, type DayType } from "./compute";
import { leaveForRun } from "./leaveServer";
import { cleanRow, timesheetToLinePatch, type RunFill, type TimesheetRow } from "./timesheet";
import { isoDate, lineRestDates, recomputeRun } from "./server";

// Server side of the daily timesheet (Payroll › Timesheets): saving entries,
// reading them back, and filling a draft payroll run from them.

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const num = (v: unknown) => Number(v) || 0;
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(utc(s).getTime()) && utc(s).toISOString().slice(0, 10) === s;
const MAX_RANGE_DAYS = 62;

export type EntryDto = TimesheetRow & { employeeId: string };

const toDto = (e: {
  employeeId: string; workDate: Date; status: "PRESENT" | "ABSENT"; timeIn: string | null; timeOut: string | null;
  days: unknown; lateMinutes: number; otHours: unknown; ndHours: unknown; ndOtHours: unknown; remarks: string | null;
}): EntryDto => ({
  employeeId: e.employeeId, date: isoDate(e.workDate), status: e.status, timeIn: e.timeIn, timeOut: e.timeOut,
  days: num(e.days), lateMinutes: e.lateMinutes, otHours: num(e.otHours), ndHours: num(e.ndHours), ndOtHours: num(e.ndOtHours), remarks: e.remarks,
});

/** Entries of the company between two dates (inclusive), optionally for one employee. */
export async function listTimesheet(companyId: string, from: string, to: string, employeeId?: string | null) {
  if (!isDate(from) || !isDate(to) || to < from) return { status: 400, error: "Choose a valid date range." };
  if ((utc(to).getTime() - utc(from).getTime()) / 86400000 > MAX_RANGE_DAYS) return { status: 400, error: `Choose at most ${MAX_RANGE_DAYS} days at a time.` };
  const rows = await prisma.timesheetEntry.findMany({
    where: { companyId, workDate: { gte: utc(from), lte: utc(to) }, ...(employeeId ? { employeeId } : {}) },
    orderBy: [{ workDate: "asc" }],
  });
  // Approved leave in the range, so the encoder sees who is on leave and doesn't mark them absent.
  const leaveIds = employeeId ? [employeeId] : (await prisma.payrollProfile.findMany({ where: { companyId, isActive: true }, select: { employeeId: true } })).map((p) => p.employeeId);
  const leaves = await leaveForRun(companyId, leaveIds, from, to);
  return {
    status: 200,
    entries: rows.map(toDto),
    leaves: Object.fromEntries([...leaves].map(([id, list]) => [id, list.map((l) => ({ date: l.date, days: l.days, paid: l.paid, code: l.code }))])),
  };
}

export type SaveEntry = Partial<Omit<TimesheetRow, "status">> & { employeeId: string; date: string; status?: "PRESENT" | "ABSENT" | "NONE" };

/** Saves (or clears, with status NONE) the given days. Only employees of the company can be written. */
export async function saveTimesheet(companyId: string, userId: string, entries: SaveEntry[]) {
  if (!Array.isArray(entries) || entries.length === 0) return { status: 400, error: "Nothing to save." };
  if (entries.length > 2000) return { status: 400, error: "Too many rows at once." };
  const ids = [...new Set(entries.map((e) => String(e.employeeId)))];
  const valid = new Set((await prisma.employee.findMany({ where: { companyId, id: { in: ids } }, select: { id: true } })).map((e) => e.id));
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let saved = 0;
  let cleared = 0;
  for (const e of entries) {
    if (!valid.has(e.employeeId)) return { status: 400, error: "An employee in this timesheet isn't in the company." };
    if (!isDate(e.date)) return { status: 400, error: "A date in this timesheet is invalid." };
    const key = { employeeId_workDate: { employeeId: e.employeeId, workDate: utc(e.date) } };
    if (e.status === "NONE") {
      writes.push(prisma.timesheetEntry.deleteMany({ where: { companyId, employeeId: e.employeeId, workDate: utc(e.date) } }));
      cleared++;
      continue;
    }
    const row = cleanRow({ ...e, status: e.status === "ABSENT" ? "ABSENT" : "PRESENT" });
    if (!row) return { status: 400, error: "A row in this timesheet is invalid." };
    const data = {
      status: row.status, timeIn: row.timeIn, timeOut: row.timeOut, days: row.days, lateMinutes: row.lateMinutes,
      otHours: row.otHours, ndHours: row.ndHours, ndOtHours: row.ndOtHours, remarks: row.remarks, enteredById: userId,
    };
    writes.push(prisma.timesheetEntry.upsert({ where: key, create: { companyId, employeeId: e.employeeId, workDate: utc(e.date), ...data }, update: data }));
    saved++;
  }
  setAuditSuppressed(true);
  try {
    await prisma.$transaction(writes);
  } finally {
    setAuditSuppressed(false);
  }
  return { status: 200, saved, cleared };
}

export type RunFillResult = RunFill & { employeeId: string };

/**
 * What the timesheets give each employee of a draft regular run, worked out
 * with the run's holidays, the employee's rest days and approved leave.
 * Employees with no entries in the period are listed in `noEntries` and left alone.
 */
export async function timesheetFillForRun(companyId: string, runId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
    include: { lines: { include: { employee: { include: { payrollProfile: true } } } } },
  });
  if (!run) return { status: 404, error: "Payroll run not found." };
  if (run.kind !== "REGULAR") return { status: 400, error: "Timesheets only apply to regular payroll runs." };
  const setup = await prisma.payrollSetup.findUnique({ where: { companyId }, select: { restWeekdays: true } });
  const start = isoDate(run.periodStart);
  const end = isoDate(run.periodEnd);
  const ids = run.lines.map((l) => l.employeeId);
  const [entries, leaves] = await Promise.all([
    prisma.timesheetEntry.findMany({ where: { companyId, employeeId: { in: ids }, workDate: { gte: run.periodStart, lte: run.periodEnd } } }),
    leaveForRun(companyId, ids, start, end),
  ]);
  const byEmployee = new Map<string, EntryDto[]>();
  for (const e of entries.map(toDto)) byEmployee.set(e.employeeId, [...(byEmployee.get(e.employeeId) ?? []), e]);

  const fills: RunFillResult[] = [];
  const noEntries: string[] = [];
  for (const line of run.lines) {
    const rows = byEmployee.get(line.employeeId);
    if (!rows?.length) { noEntries.push(line.employeeId); continue; }
    const rest = lineRestDates(line.restDates, line.employee.payrollProfile, setup?.restWeekdays ?? [0], start, end);
    const types = employeeDayTypes((run.dayTypes ?? {}) as Record<string, DayType>, rest);
    const leaveDates = new Set((leaves.get(line.employeeId) ?? []).map((l) => l.date));
    fills.push({ employeeId: line.employeeId, ...timesheetToLinePatch(rows, line.payBasis, start, end, types, leaveDates) });
  }
  return { status: 200, fills, noEntries, run: { status: run.status } };
}

/** Writes the timesheet figures into a draft run's lines and recomputes it. Returns how many employees were filled. */
export async function fillRunFromTimesheets(companyId: string, runId: string): Promise<number> {
  const r = await timesheetFillForRun(companyId, runId);
  if (r.status !== 200 || !r.fills?.length || r.run?.status !== "DRAFT") return 0;
  setAuditSuppressed(true);
  try {
    await prisma.$transaction(
      r.fills.map((f) =>
        prisma.payrollRunLine.updateMany({
          where: { runId, employeeId: f.employeeId },
          data: {
            attendance: f.attendance, absentDays: f.absentDays, lateMinutes: f.lateMinutes,
            otHours: 0, nightDiffHours: 0, dayHours: f.dayHours as unknown as Prisma.InputJsonValue,
          },
        })
      )
    );
  } finally {
    setAuditSuppressed(false);
  }
  await recomputeRun(companyId, runId);
  return r.fills.length;
}
