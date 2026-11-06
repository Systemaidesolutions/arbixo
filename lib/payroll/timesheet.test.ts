import { describe, expect, it } from "vitest";
import type { Shift } from "./biometric";
import { cleanRow, figuresFromTimes, normalizeTime, timesheetToLinePatch, totalsOf, type TimesheetRow } from "./timesheet";
import { computeLine, contributionShare, DEFAULT_RULES } from "./compute";

const shift: Shift = { start: "08:00", end: "17:00", breakMinutes: 60, lateGraceMinutes: 5, otMinimumMinutes: 30, otRoundingMinutes: 15 };

describe("times", () => {
  it("normalizes typed times", () => {
    expect(normalizeTime("8")).toBe("08:00");
    expect(normalizeTime("730")).toBe("07:30");
    expect(normalizeTime("1730")).toBe("17:30");
    expect(normalizeTime("7:05 PM")).toBe("19:05");
    expect(normalizeTime("07:58")).toBe("07:58");
    expect(normalizeTime("25:00")).toBeNull();
    expect(normalizeTime("")).toBeNull();
    expect(normalizeTime("abc")).toBeNull();
  });

  it("a full shift on time is one day with nothing extra", () => {
    expect(figuresFromTimes("2026-11-03", "07:58", "17:02", shift)).toEqual({ days: 1, lateMinutes: 0, otHours: 0, ndHours: 0, ndOtHours: 0 });
  });
  it("late and undertime are minutes, OT rounds down to the block", () => {
    expect(figuresFromTimes("2026-11-03", "08:20", "17:00", shift)).toMatchObject({ days: 1, lateMinutes: 20, otHours: 0 });
    expect(figuresFromTimes("2026-11-03", "08:00", "17:50", shift)).toMatchObject({ days: 1, lateMinutes: 0, otHours: 0.75 });
    expect(figuresFromTimes("2026-11-03", "08:00", "17:20", shift)).toMatchObject({ otHours: 0 }); // under the 30-minute minimum
    expect(figuresFromTimes("2026-11-03", "08:00", "16:30", shift)).toMatchObject({ days: 1, lateMinutes: 30 });
  });
  it("away for half the shift or more is a half day", () => {
    expect(figuresFromTimes("2026-11-03", "08:00", "12:00", shift)).toMatchObject({ days: 0.5 });
  });
  it("an overnight shift stays on the day it started and counts night hours", () => {
    const night: Shift = { ...shift, start: "22:00", end: "06:00" };
    const f = figuresFromTimes("2026-11-03", "22:00", "06:00", night)!;
    expect(f.days).toBe(1);
    expect(f.ndHours).toBe(8);
  });
  it("incomplete or unusable times give null", () => {
    expect(figuresFromTimes("2026-11-03", "08:00", null, shift)).toBeNull();
    expect(figuresFromTimes("2026-11-03", "08:00", "08:00", shift)).toBeNull();
  });
});

describe("cleanRow", () => {
  it("absent days carry no figures", () => {
    expect(cleanRow({ date: "2026-11-03", status: "ABSENT", days: 1, otHours: 2, timeIn: "08:00" })).toMatchObject({ status: "ABSENT", days: 0, otHours: 0, timeIn: null });
  });
  it("present with nothing set counts a full day; figures are bounded", () => {
    expect(cleanRow({ date: "2026-11-03", status: "PRESENT" })).toMatchObject({ days: 1, lateMinutes: 0 });
    const r = cleanRow({ date: "2026-11-03", status: "PRESENT", days: 5, otHours: 99, ndOtHours: 50, lateMinutes: -3 })!;
    expect(r).toMatchObject({ days: 1, otHours: 24, ndOtHours: 24, lateMinutes: 0 });
    expect(cleanRow({ date: "nope" })).toBeNull();
  });
});

const row = (date: string, p: Partial<TimesheetRow> = {}): TimesheetRow => ({
  date, status: "PRESENT", timeIn: null, timeOut: null, days: 1, lateMinutes: 0, otHours: 0, ndHours: 0, ndOtHours: 0, remarks: null, ...p,
});

describe("filling a run line from the timesheet", () => {
  const start = "2026-11-02"; // Monday
  const end = "2026-11-08"; // Sunday
  const rest = { "2026-11-08": "RD" as const };

  it("daily-rate: present days become attendance, OT goes in by date, late is summed", () => {
    const rows = [row("2026-11-02"), row("2026-11-03", { lateMinutes: 15, otHours: 1.5 }), row("2026-11-04", { days: 0.5 }), row("2026-11-08")];
    const p = timesheetToLinePatch(rows, "DAILY", start, end, rest, new Set());
    expect(p.attendance).toEqual({ "2026-11-02": 1, "2026-11-03": 1, "2026-11-04": 0.5, "2026-11-08": 1 });
    expect(p.dayHours["2026-11-03"]).toEqual({ ot: 1.5 });
    expect(p.lateMinutes).toBe(15);
    expect(p.presentDays).toBe(3.5);
    // Wed-Sat weren't encoded (Sun is a rest day, so it needn't be).
    expect(p.missingDates).toEqual(["2026-11-05", "2026-11-06", "2026-11-07"]);
  });

  it("monthly: only days marked ABSENT are absences; unencoded days are reported, not deducted", () => {
    const rows = [row("2026-11-02"), row("2026-11-03", { status: "ABSENT", days: 0 })];
    const p = timesheetToLinePatch(rows, "MONTHLY", start, end, rest, new Set());
    expect(p.absentDays).toBe(1);
    expect(p.absentDates).toEqual(["2026-11-03"]);
    expect(p.missingDates).toHaveLength(4);
  });

  it("monthly: working a rest day is entered by date; an absence on leave isn't an absence", () => {
    const rows = [row("2026-11-08", { days: 0.5 }), row("2026-11-04", { status: "ABSENT", days: 0 })];
    const p = timesheetToLinePatch(rows, "MONTHLY", start, end, rest, new Set(["2026-11-04"]));
    expect(p.dayHours["2026-11-08"]).toEqual({ days: 0.5 });
    expect(p.absentDays).toBe(0);
  });

  it("ignores entries outside the period", () => {
    const p = timesheetToLinePatch([row("2026-10-30"), row("2026-11-09")], "DAILY", start, end, {}, new Set());
    expect(p.attendance).toEqual({});
  });

  it("totals", () => {
    expect(totalsOf([row("a"), row("b", { days: 0.5, otHours: 2, lateMinutes: 10 }), row("c", { status: "ABSENT", days: 0 })])).toMatchObject({ present: 2, absent: 1, days: 1.5, otHours: 2, lateMinutes: 10 });
  });
});

describe("weekly contribution timing", () => {
  it("every run (and non weekly/semi-monthly groups) split the month", () => {
    expect(contributionShare("WEEKLY", "EVERY_RUN", "2026-11-06")).toBe("split");
    expect(contributionShare("WEEKLY", undefined, "2026-11-06")).toBe("split");
    expect(contributionShare("MONTHLY", "LAST_RUN", "2026-11-30")).toBe("split");
  });
  it("weekly: first run = pay date on the 1st-7th, last run = last 7 days of the month", () => {
    expect(contributionShare("WEEKLY", "FIRST_RUN", "2026-11-06")).toBe("full");
    expect(contributionShare("WEEKLY", "FIRST_RUN", "2026-11-13")).toBe("none");
    expect(contributionShare("WEEKLY", "LAST_RUN", "2026-11-27")).toBe("full"); // 27 + 7 > 30
    expect(contributionShare("WEEKLY", "LAST_RUN", "2026-11-20")).toBe("none");
    expect(contributionShare("WEEKLY", "LAST_RUN", "2026-02-27")).toBe("full"); // February has 28
  });
  it("semi-monthly: first = 1st-15th, last = 16th on", () => {
    expect(contributionShare("SEMI_MONTHLY", "FIRST_RUN", "2026-11-15")).toBe("full");
    expect(contributionShare("SEMI_MONTHLY", "FIRST_RUN", "2026-11-30")).toBe("none");
    expect(contributionShare("SEMI_MONTHLY", "LAST_RUN", "2026-11-30")).toBe("full");
  });

  const ctx = (payDate: string, timing: "EVERY_RUN" | "LAST_RUN") => ({
    periodStart: "2026-11-23", periodEnd: "2026-11-29", payDate, rules: DEFAULT_RULES,
    group: { frequency: "WEEKLY" as const, contributionTiming: timing, deductSss: true, deductPhilhealth: true, deductHdmf: true, withholdTax: false },
  });
  const input = { payBasis: "DAILY" as const, rate: 700, isMinimumWage: false, attendance: { "2026-11-23": 1, "2026-11-24": 1, "2026-11-25": 1, "2026-11-26": 1, "2026-11-27": 1, "2026-11-28": 1 } };

  it("the engine takes the whole monthly amount on the chosen run and nothing on the others", () => {
    const split = computeLine(input, ctx("2026-11-30", "EVERY_RUN"));
    const full = computeLine(input, ctx("2026-11-27", "LAST_RUN"));
    const none = computeLine(input, ctx("2026-11-20", "LAST_RUN"));
    expect(split.sssEe).toBeGreaterThan(0);
    // Whole month vs one week's share (52/12 weeks a month).
    expect(full.sssEe / split.sssEe).toBeCloseTo(52 / 12, 1);
    expect(full.philhealthEe / split.philhealthEe).toBeCloseTo(52 / 12, 1);
    expect(none.sssEe + none.philhealthEe + none.hdmfEe + none.sssEr).toBe(0);
  });
});
