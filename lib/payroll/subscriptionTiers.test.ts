import { describe, expect, it } from "vitest";
import { coverageProblem, isPayrollTier, monthKey, runMonths, tierFor, tierLadder } from "./subscriptionTiers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("payroll subscription tiers", () => {
  it("valid tiers are 20, 50, 100, then every 100", () => {
    expect([20, 50, 100, 200, 300, 1500].every(isPayrollTier)).toBe(true);
    expect([0, 10, 30, 150, 250].some(isPayrollTier)).toBe(false);
    expect(tierLadder(400).slice(0, 6)).toEqual([20, 50, 100, 200, 300, 400]);
  });
  it("picks the smallest tier that fits", () => {
    expect([1, 20, 21, 50, 51, 100, 101, 200, 201].map(tierFor)).toEqual([20, 20, 50, 50, 100, 100, 200, 200, 300]);
  });
});

describe("months a run needs", () => {
  it("regular run: every month its period touches", () => {
    expect(runMonths({ kind: "REGULAR", periodStart: d("2026-11-01"), periodEnd: d("2026-11-15"), payDate: d("2026-11-20") })).toEqual([monthKey(d("2026-11-01"))]);
    expect(runMonths({ kind: "REGULAR", periodStart: d("2026-12-28"), periodEnd: d("2027-01-03"), payDate: d("2027-01-05") })).toHaveLength(2);
  });
  it("13th-month run: the pay-date month only", () => {
    expect(runMonths({ kind: "THIRTEENTH_MONTH", periodStart: d("2026-01-01"), periodEnd: d("2026-12-31"), payDate: d("2026-12-15") })).toEqual([monthKey(d("2026-12-15"))]);
  });
});

describe("coverage check", () => {
  const nov = monthKey(d("2026-11-01"));
  const dec = monthKey(d("2026-12-01"));
  const cov = new Map([[nov, 50]]);
  it("passes when the month is paid and employees fit", () => {
    expect(coverageProblem(cov, [nov], 50)).toBeNull();
  });
  it("blocks an unpaid month", () => {
    expect(coverageProblem(cov, [nov, dec], 10)).toMatch(/isn't subscribed for December 2026/);
  });
  it("blocks when employees exceed the tier and names the tier needed", () => {
    expect(coverageProblem(cov, [nov], 51)).toMatch(/51 active payroll employees.*up to 50.*100-employee tier/);
  });
});
