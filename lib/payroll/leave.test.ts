import { describe, expect, it } from "vitest";
import { computeLine, DEFAULT_RULES } from "./compute";
import { PH_LEAVE_DEFAULTS, accruedCredits, daysByYear, eligibilityProblem, leaveDatesFor, serviceMonths, sumDays } from "./leave";

const noDeductions = { deductSss: false, deductPhilhealth: false, deductHdmf: false, withholdTax: false };

describe("leave dates", () => {
  it("skips rest weekdays for working-day leave", () => {
    // 2026-11-07 is a Saturday, 2026-11-08 a Sunday.
    const d = leaveDatesFor("2026-11-06", "2026-11-09", { restWeekdays: [0], countCalendarDays: false });
    expect(d.map((x) => x.date)).toEqual(["2026-11-06", "2026-11-07", "2026-11-09"]);
    expect(sumDays(leaveDatesFor("2026-11-06", "2026-11-09", { restWeekdays: [0, 6], countCalendarDays: false }))).toBe(2);
  });
  it("counts every date for calendar-day leave and supports a single half day", () => {
    expect(sumDays(leaveDatesFor("2026-11-01", "2027-02-13", { restWeekdays: [0], countCalendarDays: true }))).toBe(105);
    expect(sumDays(leaveDatesFor("2026-11-03", "2026-11-03", { restWeekdays: [0], countCalendarDays: false, halfDay: true }))).toBe(0.5);
  });
  it("splits a filing across years", () => {
    const m = daysByYear(leaveDatesFor("2026-12-30", "2027-01-02", { restWeekdays: [], countCalendarDays: true }));
    expect([...m]).toEqual([[2026, 2], [2027, 2]]);
  });
});

describe("credits and eligibility", () => {
  it("accrues monthly or up front", () => {
    expect(accruedCredits(15, "UPFRONT", 1)).toBe(15);
    expect(accruedCredits(15, "MONTHLY", 3)).toBe(3.75);
  });
  it("service months", () => {
    expect(serviceMonths("2025-11-15", "2026-11-14")).toBe(11);
    expect(serviceMonths("2025-11-15", "2026-11-15")).toBe(12);
  });
  it("applies the PH rules", () => {
    const t = (code: string) => PH_LEAVE_DEFAULTS.find((x) => x.code === code)!;
    const woman = { sex: "FEMALE" as const, isSoloParent: false, employmentType: "CONTRACTUAL" as const, hireDate: "2026-01-05" };
    expect(eligibilityProblem(t("ML"), woman, "2026-11-03")).toBeNull();
    expect(eligibilityProblem(t("PL"), woman, "2026-11-03")).toMatch(/male employees only/);
    expect(eligibilityProblem(t("SIL"), woman, "2026-11-03")).toMatch(/12 months/);
    expect(eligibilityProblem(t("SIL"), woman, "2027-01-05")).toBeNull();
    expect(eligibilityProblem(t("SPL"), woman, "2026-11-03")).toMatch(/solo parents/);
    expect(eligibilityProblem(t("VL"), woman, "2026-11-03")).toMatch(/employment type/);
  });
});

describe("leave in payroll", () => {
  it("daily-rate: pays paid leave at the daily rate on workdays only", () => {
    const r = computeLine(
      {
        payBasis: "DAILY", rate: 700, isMinimumWage: false,
        attendance: { "2026-11-02": 1, "2026-11-03": 1 },
        leaves: [
          { date: "2026-11-04", days: 1, paid: true }, // regular day: paid
          { date: "2026-11-05", days: 0.5, paid: true }, // half day
          { date: "2026-11-06", days: 1, paid: false }, // LWOP: nothing
        ],
      },
      { periodStart: "2026-11-02", periodEnd: "2026-11-08", dayTypes: {}, rules: DEFAULT_RULES, group: { frequency: "WEEKLY", ...noDeductions } }
    );
    expect(r.basicPay).toBe(1400);
    expect(r.leavePay).toBe(1050);
    expect(r.leaveDays).toBe(1.5);
    expect(r.unpaidLeaveDays).toBe(1);
    expect(r.grossPay).toBe(2450);
  });
  it("monthly: paid leave costs nothing, unpaid leave is deducted like an absence", () => {
    const ctx = { periodStart: "2026-11-01", periodEnd: "2026-11-15", dayTypes: {}, rules: DEFAULT_RULES, group: { frequency: "SEMI_MONTHLY" as const, ...noDeductions } };
    const paid = computeLine({ payBasis: "MONTHLY", rate: 31300, isMinimumWage: false, leaves: [{ date: "2026-11-03", days: 2, paid: true }] }, ctx);
    expect(paid.basicPay).toBe(15650);
    expect(paid.leavePay).toBe(0);
    const unpaid = computeLine({ payBasis: "MONTHLY", rate: 31300, isMinimumWage: false, leaves: [{ date: "2026-11-03", days: 1, paid: false }] }, ctx);
    expect(unpaid.basicPay).toBe(15650 - 1200); // daily rate = 31,300 x 12 / 313
  });
});
