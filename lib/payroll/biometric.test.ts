import { describe, expect, it } from "vitest";
import { atTime, computeDays, detectMapping, extractPunches, nightMinutes, normId, parseDate, parseTime, splitText, toLinePatch, type Shift } from "./biometric";

const dayShift: Shift = { start: "08:00", end: "17:00", breakMinutes: 60, lateGraceMinutes: 5, otMinimumMinutes: 30, otRoundingMinutes: 15 };

describe("reading exports", () => {
  it("parses ZKTeco attlog.dat (tab separated, no header)", () => {
    const grid = splitText("     1\t2026-11-03 07:58:12\t1\t0\t1\t0\n     1\t2026-11-03 17:02:40\t1\t1\t1\t0\n    12\t2026-11-03 08:20:00\t1\t0\t1\t0\n");
    const map = detectMapping(grid);
    expect(map.hasHeader).toBe(false);
    expect(map.idCol).toBe(0);
    expect(map.dateTimeCol).toBe(1);
    const { punches, skipped } = extractPunches(grid, map);
    expect(skipped).toBe(0);
    expect(punches.map((p) => [p.id, atTime(p.at)])).toEqual([["1", "07:58"], ["1", "17:02"], ["12", "08:20"]]);
  });
  it("parses a CSV with header and separate date/time columns, day-first dates", () => {
    const grid = splitText("AC-No.,Name,Date,Time\n0005,Juan,13/11/2026,7:55 AM\n0005,Juan,13/11/2026,5:31 PM\n");
    const map = detectMapping(grid);
    expect(map).toMatchObject({ hasHeader: true, idCol: 0, dateCol: 2, timeCol: 3, dateOrder: "DMY" });
    expect(extractPunches(grid, map).punches.map((p) => atTime(p.at))).toEqual(["07:55", "17:31"]);
  });
  it("parses one row per day with time in / time out, incl. overnight out", () => {
    const grid = splitText("Employee ID,Date,Time In,Time Out\nE-01,11/03/2026,22:00,06:10\n");
    const map = detectMapping(grid);
    expect(map).toMatchObject({ idCol: 0, dateCol: 1, inCol: 2, outCol: 3 });
    const p = extractPunches(grid, map).punches;
    expect(p).toHaveLength(2);
    expect(p[1].at - p[0].at).toBe(8 * 60 + 10);
  });
  it("dates and times in common formats", () => {
    expect(parseDate("2026/11/03 08:00")).toBe("2026-11-03");
    expect(parseDate("03-Nov-26")).toBe("2026-11-03");
    expect(parseDate("Nov 3, 2026")).toBe("2026-11-03");
    expect(parseDate("03/11/2026", "DMY")).toBe("2026-11-03");
    expect(parseTime("2026-11-03 7:05:59 PM")).toBe(19 * 60 + 5);
    expect(parseTime("12:10 AM")).toBe(10);
    expect(parseTime("0730")).toBe(450);
    expect(normId("00012")).toBe("12");
  });
});

describe("time per day", () => {
  const at = (date: string, t: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 60000 + parseTime(t)!;

  it("late beyond grace, undertime, OT rounded down after the minimum", () => {
    const days = computeDays([at("2026-11-03", "08:12"), at("2026-11-03", "12:00"), at("2026-11-03", "18:50")], dayShift, "2026-11-02", "2026-11-08");
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ days: 1, lateMinutes: 12, otHours: 1.75, ndHours: 0, ndOtHours: 0 });
    // Within grace and OT under 30 minutes: neither counted.
    const d2 = computeDays([at("2026-11-04", "08:04"), at("2026-11-04", "17:25")], dayShift, "2026-11-02", "2026-11-08");
    expect(d2[0]).toMatchObject({ lateMinutes: 0, otHours: 0 });
  });
  it("half day when away half the shift or more; single punch is incomplete", () => {
    const d = computeDays([at("2026-11-05", "08:00"), at("2026-11-05", "12:00")], dayShift, "2026-11-02", "2026-11-08");
    expect(d[0]).toMatchObject({ days: 0.5, lateMinutes: 60 }); // 300 short of 480 → half day (240) + 60 undertime
    const one = computeDays([at("2026-11-06", "08:00")], dayShift, "2026-11-02", "2026-11-08");
    expect(one[0]).toMatchObject({ incomplete: true, days: 0 });
  });
  it("overnight shift stays on its start date with night hours and night OT", () => {
    const night: Shift = { ...dayShift, start: "22:00", end: "07:00" };
    const d = computeDays([at("2026-11-03", "21:55"), at("2026-11-04", "08:00")], night, "2026-11-02", "2026-11-08");
    expect(d).toHaveLength(1);
    expect(d[0].date).toBe("2026-11-03");
    expect(d[0]).toMatchObject({ days: 1, lateMinutes: 0, ndHours: 8, otHours: 1, ndOtHours: 0 });
    expect(nightMinutes(at("2026-11-03", "20:00"), at("2026-11-04", "07:00"))).toBe(480);
  });
});

describe("into the payroll run", () => {
  const day = (date: string, extra = {}) => ({ date, in: 0, out: 1, punches: 2, incomplete: false, days: 1, lateMinutes: 0, otHours: 0, ndHours: 0, ndOtHours: 0, ...extra });
  it("daily-rate: attendance per date, OT by date, late summed", () => {
    const p = toLinePatch([day("2026-11-02", { lateMinutes: 10 }), day("2026-11-08", { otHours: 2 })], "DAILY", "2026-11-02", "2026-11-08", { "2026-11-08": "RD" }, new Set());
    expect(p.attendance).toEqual({ "2026-11-02": 1, "2026-11-08": 1 });
    expect(p.dayHours).toEqual({ "2026-11-08": { ot: 2 } });
    expect(p.lateMinutes).toBe(10);
  });
  it("monthly-paid: absences on ordinary days without punches or leave; rest-day work by date", () => {
    const p = toLinePatch([day("2026-11-02"), day("2026-11-08")], "MONTHLY", "2026-11-02", "2026-11-08", { "2026-11-08": "RD", "2026-11-04": "RH" }, new Set(["2026-11-05"]));
    // Tue 3, Fri 6, Sat 7 absent (Wed 4 holiday, Thu 5 on leave).
    expect(p.absentDays).toBe(3);
    expect(p.dayHours).toEqual({ "2026-11-08": { days: 1 } });
  });
});
