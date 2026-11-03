import { describe, expect, it } from "vitest";
import { annualIncomeTax, computeLine, DEFAULT_RULES, hdmfMonthly, periodDates, philhealthMonthly, sssMonthly } from "./compute";

const allOn = { deductSss: true, deductPhilhealth: true, deductHdmf: true, withholdTax: true };

describe("statutory tables", () => {
  it("SSS rounds to the nearest 500 MSC with floor/ceiling and EC", () => {
    expect(sssMonthly(4000)).toEqual({ ee: 250, er: 510 });
    expect(sssMonthly(5249)).toEqual({ ee: 250, er: 510 });
    expect(sssMonthly(5250)).toEqual({ ee: 275, er: 560 });
    expect(sssMonthly(20000)).toEqual({ ee: 1000, er: 2030 });
    expect(sssMonthly(80000)).toEqual({ ee: 1750, er: 3530 });
  });
  it("PhilHealth 5% with floor and ceiling", () => {
    expect(philhealthMonthly(8000)).toEqual({ ee: 250, er: 250 });
    expect(philhealthMonthly(30000)).toEqual({ ee: 750, er: 750 });
    expect(philhealthMonthly(150000)).toEqual({ ee: 2500, er: 2500 });
  });
  it("Pag-IBIG caps at 200", () => {
    expect(hdmfMonthly(1200)).toEqual({ ee: 12, er: 24 });
    expect(hdmfMonthly(30000)).toEqual({ ee: 200, er: 200 });
  });
  it("TRAIN annual tax", () => {
    expect(annualIncomeTax(250000)).toBe(0);
    expect(annualIncomeTax(400000)).toBe(22500);
    expect(annualIncomeTax(1000000)).toBe(152500);
  });
});

describe("computeLine", () => {
  it("daily contractual: pays per day worked with holiday/rest-day premiums", () => {
    const ctx = {
      periodStart: "2026-11-02",
      periodEnd: "2026-11-08",
      dayTypes: { "2026-11-08": "RD" as const, "2026-11-04": "RH" as const },
      rules: DEFAULT_RULES,
      group: { frequency: "WEEKLY" as const, deductSss: false, deductPhilhealth: false, deductHdmf: false, withholdTax: false },
    };
    expect(periodDates(ctx.periodStart, ctx.periodEnd)).toHaveLength(7);
    const r = computeLine(
      {
        payBasis: "DAILY",
        rate: 700,
        isMinimumWage: true,
        // Mon–Wed worked, Thu (regular holiday) not worked, Fri half day, Sun rest day worked.
        attendance: { "2026-11-02": 1, "2026-11-03": 1, "2026-11-05": 1, "2026-11-06": 0.5, "2026-11-08": 1 },
        otHours: 2,
      },
      ctx
    );
    expect(r.daysWorked).toBe(4.5);
    // 4.5 days worked + 1 unworked regular holiday = 5.5 × 700
    expect(r.basicPay).toBe(3850);
    expect(r.premiumPay).toBe(210); // rest day 30%
    expect(r.otPay).toBe(218.75); // 87.5/hr × 1.25 × 2
    expect(r.grossPay).toBe(4278.75);
    expect(r.netPay).toBe(4278.75);
  });

  it("monthly employee on semi-monthly: half salary, contributions split in two, tax annualized", () => {
    const r = computeLine(
      { payBasis: "MONTHLY", rate: 30000, isMinimumWage: false },
      { periodStart: "2026-11-01", periodEnd: "2026-11-15", rules: DEFAULT_RULES, group: { frequency: "SEMI_MONTHLY", ...allOn } }
    );
    expect(r.basicPay).toBe(15000);
    expect(r.sssEe).toBe(750);
    expect(r.philhealthEe).toBe(375);
    expect(r.hdmfEe).toBe(100);
    expect(r.taxableIncome).toBe(13775);
    // annual 330,600 → 12,090 tax → /24
    expect(r.withholdingTax).toBe(503.75);
    expect(r.netPay).toBe(13271.25);
  });
});
