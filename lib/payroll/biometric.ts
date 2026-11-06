// Biometric attendance import — pure helpers shared by the import panel (browser)
// and tests. Turns a device export into punches, punches into per-day time
// (late, undertime, OT, night hours) against a shift, and that into payroll-run
// line inputs. No DB access.
//
// Supported exports: CSV/TXT/DAT (comma, tab, semicolon or space separated,
// e.g. ZKTeco attlog.dat) and XLSX (read on the server into the same text grid).
// Either one row per punch (ID + date/time, or ID + date + time) or one row per
// day (ID + date + time in + time out).

import { periodDates, type DayHours, type DayType, type PayBasis } from "./compute";

export type Grid = string[][];
export type DateOrder = "MDY" | "DMY" | "YMD";

export type Mapping = {
  hasHeader: boolean;
  idCol: number;
  dateTimeCol: number | null; // one column holding date and time
  dateCol: number | null; // or separate date + time columns
  timeCol: number | null;
  inCol: number | null; // or time in / time out columns (one row per day)
  outCol: number | null;
  dateOrder: DateOrder;
};

export type Shift = {
  start: string; // "08:00"
  end: string; // "17:00"; at or before start = overnight
  breakMinutes: number;
  lateGraceMinutes: number;
  otMinimumMinutes: number;
  otRoundingMinutes: number;
};

/** A punch as minutes since 1970-01-01 00:00 of the device's local clock (no timezone). */
export type Punch = { id: string; at: number };

export type DayTime = {
  date: string;
  in: number | null;
  out: number | null;
  punches: number;
  incomplete: boolean; // a single punch: no hours computed
  days: number; // 1, or 0.5 for a half day
  lateMinutes: number; // late + undertime
  otHours: number;
  ndHours: number; // night hours within the shift
  ndOtHours: number; // OT hours at night
};

// ---------------- Reading the file ----------------

/** Splits a text export into a grid, guessing the delimiter. Handles quoted CSV fields. */
export function splitText(text: string): Grid {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const sample = lines.slice(0, 20).join("\n");
  const delim = sample.includes("\t") ? "\t" : sample.includes(",") ? "," : sample.includes(";") ? ";" : null;
  return lines.map((line) => {
    if (!delim) return line.trim().split(/\s+/);
    const out: string[] = [];
    let field = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
      } else if (c === '"') q = true;
      else if (c === delim) { out.push(field.trim()); field = ""; } else field += c;
    }
    out.push(field.trim());
    return out;
  });
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const validYmd = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100;

/** Date part of a cell → YYYY-MM-DD. Accepts ISO, slashed/dashed numeric dates (in `order`), and "03-Nov-2026". */
export function parseDate(s: string, order: DateOrder = "MDY"): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) { const [y, mo, d] = [+m[1], +m[2], +m[3]]; return validYmd(y, mo, d) ? iso(y, mo, d) : null; }
  m = t.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ,]+(\d{2,4})/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const mo = MONTHS[m[2].toLowerCase()]; return mo && validYmd(y, mo, +m[1]) ? iso(y, mo, +m[1]) : null; }
  m = t.match(/^([A-Za-z]{3})[A-Za-z]*[ -](\d{1,2}),?[ -](\d{4})/);
  if (m) { const mo = MONTHS[m[1].toLowerCase()]; return mo && validYmd(+m[3], mo, +m[2]) ? iso(+m[3], mo, +m[2]) : null; }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const [mo, d] = order === "DMY" ? [+m[2], +m[1]] : [+m[1], +m[2]];
    return validYmd(y, mo, d) ? iso(y, mo, d) : null;
  }
  return null;
}

/** Time part of a cell → minutes after midnight. Accepts "07:58", "7:58:12", "7:58 PM", "1958". Looks after a date if there is one. */
export function parseTime(s: string): number | null {
  const t = s.trim();
  const m = t.match(/(?:^|[\sT])(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/) ?? t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (m) {
    let h = +m[1];
    const mi = +m[2];
    const ap = m[4]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return h < 24 && mi < 60 ? h * 60 + mi : null;
  }
  const c = t.match(/^(\d{2})(\d{2})$/);
  if (c && +c[1] < 24 && +c[2] < 60) return +c[1] * 60 + +c[2];
  return null;
}

export const toAt = (date: string, minutes: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 60000 + minutes;
};
export const atDate = (at: number) => new Date(at * 60000).toISOString().slice(0, 10);
export const atTime = (at: number) => new Date(at * 60000).toISOString().slice(11, 16);

const looksDateTime = (s: string) => /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}.*\d{1,2}:\d{2}/.test(s) || /\d{1,2}[-/. ][A-Za-z]{3}.*\d{1,2}:\d{2}/.test(s);
const looksDate = (s: string) => parseDate(s, "MDY") !== null || parseDate(s, "DMY") !== null;
const looksTime = (s: string) => /^\d{1,2}:\d{2}(:\d{2})?\s*([AaPp][Mm])?$/.test(s.trim());

/** Guesses the columns from the header row (if any) and the values. */
export function detectMapping(grid: Grid): Mapping {
  const first = grid[0] ?? [];
  const hasHeader = first.length > 0 && !first.some((c) => looksDateTime(c) || looksDate(c) || looksTime(c));
  const head = hasHeader ? first.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "")) : [];
  const body = grid.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 50);
  const cols = Math.max(0, ...grid.slice(0, 50).map((r) => r.length));
  const share = (c: number, f: (s: string) => boolean) => body.length ? body.filter((r) => r[c] && f(r[c])).length / body.length : 0;
  const byHead = (re: RegExp) => head.findIndex((h) => re.test(h));
  const firstCol = (f: (c: number) => boolean) => { for (let c = 0; c < cols; c++) if (f(c)) return c; return -1; };

  let inCol = byHead(/^(timein|clockin|checkin|in|amin|login|firstin|onduty)$/);
  let outCol = byHead(/^(timeout|clockout|checkout|out|pmout|logout|lastout|offduty)$/);
  let dateTimeCol = byHead(/^(datetime|checktime|punchtime|logtime|timestamp|attendancetime|datetimerecord)$/);
  let dateCol = byHead(/^(date|day|logdate|workdate|attendancedate|punchdate)$/);
  let timeCol = byHead(/^(time|logtime|punch|clocktime)$/);
  let idCol = byHead(/^(id|userid|empid|employeeid|employeeno|empno|acno|no|enrollno|badge|badgeno|pin|code|employeecode|biometricid|personid|staffid)$/);

  if (dateTimeCol < 0 && dateCol < 0) dateTimeCol = firstCol((c) => share(c, looksDateTime) > 0.8);
  if (dateTimeCol < 0 && dateCol < 0) dateCol = firstCol((c) => share(c, looksDate) > 0.8);
  if (dateTimeCol < 0 && dateCol >= 0 && timeCol < 0 && inCol < 0) timeCol = firstCol((c) => c !== dateCol && share(c, looksTime) > 0.8);
  if (idCol < 0) idCol = firstCol((c) => c !== dateTimeCol && c !== dateCol && c !== timeCol && share(c, (s) => /^[A-Za-z0-9-]{1,20}$/.test(s.trim()) && !looksTime(s)) > 0.8);
  if (inCol >= 0 && outCol < 0) inCol = -1;
  if (outCol >= 0 && inCol < 0) outCol = -1;

  // Plain date in the "datetime" column with separate in/out columns.
  const n = (v: number) => (v >= 0 ? v : null);
  return {
    hasHeader,
    idCol: Math.max(0, idCol),
    dateTimeCol: inCol >= 0 ? null : n(dateTimeCol),
    dateCol: n(dateCol >= 0 ? dateCol : inCol >= 0 ? dateTimeCol : -1),
    timeCol: inCol >= 0 ? null : n(timeCol),
    inCol: n(inCol),
    outCol: n(outCol),
    dateOrder: guessDateOrder(body.map((r) => r[dateTimeCol >= 0 ? dateTimeCol : dateCol] ?? "")),
  };
}

/** DMY if any numeric date has a first part above 12; otherwise MDY (the app's default). */
export function guessDateOrder(samples: string[]): DateOrder {
  for (const s of samples) {
    const m = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (m && +m[1] > 12) return "DMY";
  }
  return "MDY";
}

/** Rows → punches. Unreadable rows are counted, not thrown. */
export function extractPunches(grid: Grid, map: Mapping): { punches: Punch[]; skipped: number } {
  const punches: Punch[] = [];
  let skipped = 0;
  for (const row of grid.slice(map.hasHeader ? 1 : 0)) {
    const id = (row[map.idCol] ?? "").trim();
    if (!id) { skipped++; continue; }
    const add = (date: string | null, t: number | null) => { if (date && t != null) punches.push({ id, at: toAt(date, t) }); };
    if (map.inCol != null && map.outCol != null && map.dateCol != null) {
      const date = parseDate(row[map.dateCol] ?? "", map.dateOrder);
      const tin = parseTime(row[map.inCol] ?? "");
      const tout = parseTime(row[map.outCol] ?? "");
      if (!date || (tin == null && tout == null)) { skipped++; continue; }
      add(date, tin);
      // An out time earlier than the in time is the next morning (overnight shift).
      if (tout != null) add(tin != null && tout < tin ? nextDay(date) : date, tout);
    } else if (map.dateTimeCol != null) {
      const cell = row[map.dateTimeCol] ?? "";
      const date = parseDate(cell, map.dateOrder);
      const t = parseTime(cell);
      if (!date || t == null) { skipped++; continue; }
      add(date, t);
    } else if (map.dateCol != null && map.timeCol != null) {
      const date = parseDate(row[map.dateCol] ?? "", map.dateOrder);
      const t = parseTime(row[map.timeCol] ?? "");
      if (!date || t == null) { skipped++; continue; }
      add(date, t);
    } else skipped++;
  }
  return { punches, skipped };
}

const nextDay = (date: string) => atDate(toAt(date, 0) + 1440);

/** Device ID ↔ employee: biometric ID first, then employee code; leading zeros ignored. */
export const normId = (s: string) => s.trim().toUpperCase().replace(/^0+(?=\d)/, "");

// ---------------- Time computation ----------------

const hm = (s: string) => parseTime(s) ?? 0;
const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/** Minutes of [from, to) between 10:00 pm and 6:00 am (Art. 86). */
export function nightMinutes(from: number, to: number): number {
  if (to <= from) return 0;
  let total = 0;
  const firstDay = Math.floor(from / 1440) - 1;
  const lastDay = Math.floor(to / 1440);
  for (let d = firstDay; d <= lastDay; d++) total += overlap(from, to, d * 1440 + 22 * 60, d * 1440 + 30 * 60);
  return total;
}

/**
 * One employee's punches → time per work date in the period. A punch belongs
 * to the work date whose shift starts within the next 6 hours or began in the
 * previous 18, so overnight shifts stay on the date they started. First punch
 * = in, last = out; punches within 2 minutes of each other are one.
 */
export function computeDays(punches: number[], shift: Shift, periodStart: string, periodEnd: string): DayTime[] {
  const start = hm(shift.start);
  let end = hm(shift.end);
  if (end <= start) end += 1440;
  const anchor = start - 6 * 60;
  const byDate = new Map<string, number[]>();
  for (const at of [...punches].sort((a, b) => a - b)) {
    const date = atDate(at - anchor);
    const list = byDate.get(date) ?? [];
    if (!list.length || at - list[list.length - 1] > 2) list.push(at);
    byDate.set(date, list);
  }
  const scheduled = Math.max(60, end - start - shift.breakMinutes);
  const out: DayTime[] = [];
  for (const date of periodDates(periodStart, periodEnd)) {
    const list = byDate.get(date);
    if (!list?.length) continue;
    const base = toAt(date, 0);
    const sStart = base + start;
    const sEnd = base + end;
    const tin = list[0];
    const tout = list.length > 1 ? list[list.length - 1] : null;
    const day: DayTime = { date, in: tin, out: tout, punches: list.length, incomplete: tout == null, days: 0, lateMinutes: 0, otHours: 0, ndHours: 0, ndOtHours: 0 };
    if (tout == null) { out.push(day); continue; }

    const late = tin - sStart > shift.lateGraceMinutes ? tin - sStart : 0;
    const under = Math.max(0, sEnd - tout);
    let short = Math.min(scheduled, late + under);
    day.days = 1;
    // Away for half the shift or more: a half day, with the half not charged as late.
    if (short >= scheduled / 2) { day.days = 0.5; short = Math.max(0, short - scheduled / 2); }
    day.lateMinutes = Math.round(short);

    let ot = Math.max(0, tout - sEnd);
    if (ot < shift.otMinimumMinutes) ot = 0;
    const block = Math.max(1, shift.otRoundingMinutes);
    ot = Math.floor(ot / block) * block;
    day.otHours = round2(ot / 60);
    day.ndHours = round2(nightMinutes(Math.max(tin, sStart), Math.min(tout, sEnd)) / 60);
    day.ndOtHours = ot ? round2(Math.min(ot, nightMinutes(sEnd, sEnd + ot)) / 60) : 0;
    out.push(day);
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------- Into a payroll-run line ----------------

export type LinePatch = {
  attendance: Record<string, number>;
  absentDays: number;
  lateMinutes: number;
  otHours: number;
  nightDiffHours: number;
  dayHours: Record<string, DayHours>;
};

/**
 * Builds the run-line inputs from imported days. Replaces attendance, absences,
 * late/undertime and OT/night hours; overtime and night hours go in by date so
 * each is paid at its day type. Daily-rate: a day per date present. Monthly-paid:
 * ordinary workdays without punches or approved leave are absences, and work
 * on rest days / special days / holidays is entered by date.
 */
export function toLinePatch(days: DayTime[], payBasis: PayBasis, periodStart: string, periodEnd: string, dayTypes: Record<string, DayType>, leaveDates: Set<string>): LinePatch {
  const typeOf = (d: string): DayType => dayTypes[d] ?? "REG";
  const attendance: Record<string, number> = {};
  const dayHours: Record<string, DayHours> = {};
  let late = 0;
  const present = new Set<string>();
  for (const d of days) {
    if (d.incomplete || !d.days) continue;
    present.add(d.date);
    const t = typeOf(d.date);
    if (payBasis === "DAILY") attendance[d.date] = d.days;
    const h: DayHours = { ot: d.otHours || undefined, nd: d.ndHours || undefined, ndOt: d.ndOtHours || undefined };
    if (payBasis === "MONTHLY" && t !== "REG") h.days = d.days;
    if (h.days || h.ot || h.nd || h.ndOt) dayHours[d.date] = h;
    if (t === "REG" || payBasis === "DAILY") late += d.lateMinutes;
  }
  let absentDays = 0;
  if (payBasis === "MONTHLY") {
    for (const date of periodDates(periodStart, periodEnd)) {
      const t = typeOf(date);
      if (t === "REG" && !present.has(date) && !leaveDates.has(date)) absentDays++;
    }
  }
  return { attendance, absentDays, lateMinutes: late, otHours: 0, nightDiffHours: 0, dayHours };
}
