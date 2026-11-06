// Daily timesheet — pure helpers shared by the timesheet page (browser), the
// server (saving, filling a payroll run) and tests. No DB access.
//
// A secretary encodes each employee's day: time in / time out (the figures are
// worked out against the shift, exactly like the biometric import), or just a
// present / half-day / absent mark. The saved entries are the basis of a
// payroll run: `timesheetToLinePatch` turns a period's entries into the run
// line's inputs (days worked, absences, late/undertime, OT and night hours).

import { parseTime, toAt, computeDays, toLinePatch, type DayTime, type LinePatch, type Shift } from "./biometric";
import { periodDates, type DayType, type PayBasis } from "./compute";

export type TimesheetStatus = "PRESENT" | "ABSENT";

export type Figures = { days: number; lateMinutes: number; otHours: number; ndHours: number; ndOtHours: number };

export type TimesheetRow = Figures & {
  date: string; // YYYY-MM-DD, the day the shift starts
  status: TimesheetStatus;
  timeIn: string | null; // HH:mm
  timeOut: string | null; // HH:mm; at or before timeIn = the next morning
  remarks: string | null;
};

export const NO_FIGURES: Figures = { days: 0, lateMinutes: 0, otHours: 0, ndHours: 0, ndOtHours: 0 };

const r2 = (n: number) => Math.round(n * 100) / 100;
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "7:5" / "0705" / "7:05 PM" → "07:05"; null if it isn't a time. */
export function normalizeTime(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  // Bare digits: "8" = 08:00, "730" = 07:30, "1730" = 17:30.
  const digits = /^\d{1,4}$/.test(t) ? t.padStart(t.length <= 2 ? 2 : 4, "0") : null;
  const v = parseTime(digits ? (digits.length === 2 ? `${digits}:00` : `${digits.slice(0, 2)}:${digits.slice(2)}`) : t);
  if (v == null || v < 0 || v >= 1440) return null;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

export const isTime = (s: string | null | undefined): s is string => !!s && TIME.test(s);

/**
 * Days, late/undertime, OT and night hours for one day's time in and out,
 * against the employee's shift (same rules as the biometric import: grace
 * minutes, half day when away for half the shift or more, OT minimum and
 * rounding, night hours 10pm-6am). Null when the times can't be used.
 */
export function figuresFromTimes(date: string, timeIn: string | null, timeOut: string | null, shift: Shift): Figures | null {
  const tin = timeIn ? parseTime(timeIn) : null;
  const tout = timeOut ? parseTime(timeOut) : null;
  if (tin == null || tout == null) return null;
  const base = toAt(date, 0);
  const inAt = base + tin;
  let outAt = base + tout;
  if (outAt <= inAt) outAt += 1440; // out before in = next morning
  const day = computeDays([inAt, outAt], shift, date, date)[0];
  if (!day || day.incomplete || !day.days) return null;
  return { days: day.days, lateMinutes: day.lateMinutes, otHours: day.otHours, ndHours: day.ndHours, ndOtHours: day.ndOtHours };
}

/** Cleans an entry before saving: bounds every figure, drops figures from an absent day. */
export function cleanRow(raw: Partial<TimesheetRow> & { date: string }): TimesheetRow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  const status: TimesheetStatus = raw.status === "ABSENT" ? "ABSENT" : "PRESENT";
  const remarks = (raw.remarks ?? "").toString().trim().slice(0, 200) || null;
  if (status === "ABSENT") return { date: raw.date, status, timeIn: null, timeOut: null, remarks, ...NO_FIGURES };
  const timeIn = normalizeTime(raw.timeIn);
  const timeOut = normalizeTime(raw.timeOut);
  const bound = (v: unknown, max: number) => r2(Math.min(max, Math.max(0, Number(v) || 0)));
  let days = bound(raw.days, 1);
  if (days === 0) days = 1; // a present day counts at least a half; unset means a full day
  return {
    date: raw.date, status, timeIn, timeOut, remarks, days,
    lateMinutes: Math.round(bound(raw.lateMinutes, 1440)),
    otHours: bound(raw.otHours, 24),
    ndHours: bound(raw.ndHours, 24),
    ndOtHours: Math.min(bound(raw.ndOtHours, 24), bound(raw.otHours, 24)),
  };
}

export type RunFill = LinePatch & {
  /** Workdays (ordinary days, not on leave) in the period with no timesheet entry. */
  missingDates: string[];
  presentDays: number;
  absentDates: string[];
};

/**
 * One employee's timesheet entries → the payroll-run line inputs. Like the
 * biometric import, but a day only counts as an absence (monthly-paid staff)
 * when it is marked ABSENT; days nobody encoded are reported in `missingDates`
 * instead of being deducted, so a half-finished timesheet never costs anyone pay.
 * Daily-rate staff are paid for PRESENT days only, so an unencoded day is
 * unpaid until it is filled in.
 */
export function timesheetToLinePatch(
  rows: TimesheetRow[], payBasis: PayBasis, periodStart: string, periodEnd: string,
  dayTypes: Record<string, DayType>, leaveDates: Set<string>,
): RunFill {
  const inPeriod = rows.filter((r) => r.date >= periodStart && r.date <= periodEnd);
  const days: DayTime[] = inPeriod
    .filter((r) => r.status === "PRESENT" && r.days > 0)
    .map((r) => ({
      date: r.date, in: null, out: null, punches: 2, incomplete: false,
      days: r.days, lateMinutes: r.lateMinutes, otHours: r.otHours, ndHours: r.ndHours, ndOtHours: r.ndOtHours,
    }));
  const patch = toLinePatch(days, payBasis, periodStart, periodEnd, dayTypes, leaveDates);

  const typeOf = (d: string): DayType => dayTypes[d] ?? "REG";
  const present = new Set(days.map((d) => d.date));
  const marked = new Map(inPeriod.map((r) => [r.date, r.status]));
  const absentDates = inPeriod
    .filter((r) => r.status === "ABSENT" && typeOf(r.date) === "REG" && !leaveDates.has(r.date))
    .map((r) => r.date);
  const missingDates = periodDates(periodStart, periodEnd).filter((d) => typeOf(d) === "REG" && !marked.has(d) && !leaveDates.has(d));
  return {
    ...patch,
    absentDays: payBasis === "MONTHLY" ? absentDates.length : 0,
    missingDates,
    presentDays: r2(days.reduce((s, d) => s + d.days, 0)),
    absentDates,
  };
}

/** Totals of a set of rows, for the summary. */
export function totalsOf(rows: TimesheetRow[]) {
  const t = { present: 0, absent: 0, days: 0, lateMinutes: 0, otHours: 0, ndHours: 0 };
  for (const r of rows) {
    if (r.status === "ABSENT") { t.absent++; continue; }
    t.present++;
    t.days += r.days; t.lateMinutes += r.lateMinutes; t.otHours += r.otHours; t.ndHours += r.ndHours;
  }
  return { ...t, days: r2(t.days), otHours: r2(t.otHours), ndHours: r2(t.ndHours) };
}
