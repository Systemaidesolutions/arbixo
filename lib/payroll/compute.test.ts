import { describe, expect, it } from "vitest";
import { annualIncomeTax, computeLine, employeeDayTypes, restDatesFor, computeThirteenth, DEFAULT_RULES, hdmfMonthly, periodDates, philhealthMonthly, sssMonthly, thirteenthMonthBase, type DayHours, type DayType } from "./compute";

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
    expect(r.basicPay).toBe(3150); // 4.5 days × 700
    expect(r.holidayPay).toBe(700); // unworked regular holiday, present the day before
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

// Rates from the DOLE Handbook on Workers' Statutory Monetary Benefits (2024), Compliance Guide A.
describe("handbook rates", () => {
  const weekly = { frequency: "WEEKLY" as const, deductSss: false, deductPhilhealth: false, deductHdmf: false, withholdTax: false };
  // 800/day → 100/hour, so each multiplier reads straight off the result.
  const day = (type: DayType, attendance = 1, h: DayHours = {}) =>
    computeLine(
      { payBasis: "DAILY", rate: 800, isMinimumWage: false, attendance: { "2026-11-03": attendance, "2026-11-02": 1 }, dayHours: { "2026-11-03": h } },
      { periodStart: "2026-11-02", periodEnd: "2026-11-03", dayTypes: { "2026-11-03": type }, rules: DEFAULT_RULES, group: weekly }
    );
  const dayPay = (r: ReturnType<typeof day>) => r.basicPay - 800 + r.premiumPay; // less Monday

  it("work on each day type (first 8 hours)", () => {
    const expected: [DayType, number][] = [["REG", 1], ["RD", 1.3], ["SH", 1.3], ["SHRD", 1.5], ["DSH", 1.5], ["DSHRD", 1.95], ["RH", 2], ["RHRD", 2.6], ["DH", 3], ["DHRD", 3.9]];
    for (const [t, m] of expected) expect(dayPay(day(t))).toBeCloseTo(800 * m, 2);
  });
  it("overtime per hour: 125% ordinary, 130% of the day's rate otherwise", () => {
    const ot: [DayType, number][] = [["REG", 1.25], ["RD", 1.69], ["SHRD", 1.95], ["DSHRD", 2.535], ["RH", 2.6], ["RHRD", 3.38], ["DH", 3.9], ["DHRD", 5.07]];
    for (const [t, m] of ot) expect(day(t, 1, { ot: 1 }).otPay).toBeCloseTo(100 * m, 2);
  });
  it("night shift: +10% of the hour's rate, also on night OT", () => {
    // Ordinary night hour 110% → ND part 10; rest day night 143% → 13.
    expect(day("REG", 1, { nd: 1 }).nightDiffPay).toBeCloseTo(10, 2);
    expect(day("RD", 1, { nd: 1 }).nightDiffPay).toBeCloseTo(13, 2);
    // Ordinary night OT 137.5% = OT 125 + ND 12.5; regular holiday night OT 286% = 260 + 26.
    expect(day("REG", 1, { ot: 1, ndOt: 1 }).nightDiffPay + day("REG", 1, { ot: 1 }).otPay).toBeCloseTo(137.5, 2);
    expect(day("RH", 1, { ot: 1, ndOt: 1 }).nightDiffPay + day("RH", 1, { ot: 1 }).otPay).toBeCloseTo(286, 2);
  });
  it("unworked holidays: 100% regular, 200% double, nothing on special days", () => {
    expect(day("RH", 0).holidayPay).toBe(800);
    expect(day("DH", 0).holidayPay).toBe(1600);
    expect(day("SH", 0).holidayPay).toBe(0);
  });
  it("no holiday pay when absent on the workday before; successive holidays follow the first", () => {
    const run = (attendance: Record<string, number>, leaves: { date: string; days: number; paid: boolean }[] = []) =>
      computeLine(
        { payBasis: "DAILY", rate: 800, isMinimumWage: false, attendance, leaves },
        // Wed ordinary, Thu + Fri regular holidays (Maundy Thursday / Good Friday).
        { periodStart: "2026-04-01", periodEnd: "2026-04-03", dayTypes: { "2026-04-02": "RH", "2026-04-03": "RH" }, rules: DEFAULT_RULES, group: weekly }
      );
    expect(run({ "2026-04-01": 1 }).holidayPay).toBe(1600); // present Wed → both paid
    expect(run({}).holidayPay).toBe(0); // absent Wed → neither
    expect(run({ "2026-04-02": 1 }).holidayPay).toBe(800); // absent Wed, works Thu → Fri paid
    expect(run({}, [{ date: "2026-04-01", days: 1, paid: true }]).holidayPay).toBe(1600); // paid leave Wed counts as present
  });
  it("monthly-paid: work on a holiday or rest day earns only what the salary doesn't cover", () => {
    // 20,866.67 x 12 / 313 = 800/day
    const m = (type: DayType, rules = DEFAULT_RULES) =>
      computeLine(
        { payBasis: "MONTHLY", rate: 800 * 313 / 12, isMinimumWage: false, dayHours: { "2026-11-30": { days: 1 } } },
        { periodStart: "2026-11-16", periodEnd: "2026-11-30", dayTypes: { "2026-11-30": type }, rules, group: { ...weekly, frequency: "SEMI_MONTHLY" } }
      ).premiumPay;
    expect(m("RH")).toBeCloseTo(800, 2); // 200% less the 100% in salary
    expect(m("RD")).toBeCloseTo(1040, 2); // 313 factor: rest days unpaid → 130%
    expect(m("SH")).toBeCloseTo(240, 2); // special days in salary → +30%
    expect(m("RD", { ...DEFAULT_RULES, monthlyIncludesRestDays: true })).toBeCloseTo(240, 2); // 365 factor
  });
  it("minimum wage earner: holiday/OT exempt, commissions and taxable allowances are taxed", () => {
    const r = computeLine(
      {
        payBasis: "DAILY", rate: 645, isMinimumWage: true, attendance: { "2026-11-02": 1 }, otHours: 3,
        adjustments: [{ payItemId: "c", code: "COMM", name: "Commission", kind: "EARNING", taxable: true, amount: 20000 }],
      },
      { periodStart: "2026-11-01", periodEnd: "2026-11-15", rules: DEFAULT_RULES, group: { frequency: "SEMI_MONTHLY", deductSss: false, deductPhilhealth: false, deductHdmf: false, withholdTax: true } }
    );
    expect(r.taxableIncome).toBe(20000);
    expect(r.withholdingTax).toBeGreaterThan(0);
  });
  it("bonuses share the ₱90,000 exemption; only the excess is taxable", () => {
    const r = computeLine(
      {
        payBasis: "MONTHLY", rate: 30000, isMinimumWage: false, benefitsExemptRemaining: 5000,
        adjustments: [{ payItemId: "b", code: "XMAS", name: "Christmas bonus", kind: "EARNING", taxable: true, isOtherBenefit: true, amount: 8000 }],
      },
      { periodStart: "2026-12-01", periodEnd: "2026-12-15", rules: DEFAULT_RULES, group: { frequency: "SEMI_MONTHLY", ...allOn } }
    );
    expect(r.exemptBenefits).toBe(5000);
    expect(r.taxableIncome).toBe(13775 + 3000);
    expect(r.sssEe).toBe(750); // bonus not part of SSS compensation
  });
});

describe("13th-month pay", () => {
  it("handbook example: 1/12 of basic salary earned", () => {
    // Handbook 13th-month D: ₱184,219.96 basic salary for the year → ₱15,351.66.
    const t = computeThirteenth({ basis: 184219.96, alreadyPaid: 0, benefitsExemptRemaining: 90000, ytdTaxable: 0, withholdTax: true });
    expect(t.pay).toBe(15351.66);
    expect(t.tax).toBe(0);
  });
  it("pays the balance after a mid-year half and taxes only the excess over the cap", () => {
    const t = computeThirteenth({ basis: 1200000, alreadyPaid: 50000, benefitsExemptRemaining: 40000, ytdTaxable: 1000000, withholdTax: true });
    expect(t.pay).toBe(50000);
    expect(t.exempt).toBe(40000);
    expect(t.tax).toBe(2500); // 10,000 at 25%
  });
  it("base excludes OT/premiums/holiday pay but keeps paid leave, less lates", () => {
    expect(thirteenthMonthBase({ basicPay: 3150, leavePay: 700, lateDeduction: 50 })).toBe(3800);
  });
});

describe("per-employee rest days", () => {
  it("combines run holidays with the employee's own rest days", () => {
    const types = employeeDayTypes({ "2026-11-01": "RD", "2026-11-04": "RH", "2026-11-05": "SH" }, ["2026-11-04", "2026-11-06"]);
    // run-wide RD is dropped (rest days come from the employee); holiday on rest day gets +R
    expect(types).toEqual({ "2026-11-04": "RHRD", "2026-11-05": "SH", "2026-11-06": "RD" });
    expect(restDatesFor("2026-11-01", "2026-11-15", [0])).toEqual(["2026-11-01", "2026-11-08", "2026-11-15"]);
  });
  it("pays work on the employee's own rest day at 130%", () => {
    const ctx = {
      periodStart: "2026-11-02", periodEnd: "2026-11-08", dayTypes: {}, rules: DEFAULT_RULES,
      group: { frequency: "WEEKLY" as const, deductSss: false, deductPhilhealth: false, deductHdmf: false, withholdTax: false },
    };
    const base = { payBasis: "DAILY" as const, rate: 600, isMinimumWage: false, absentDays: 0, lateMinutes: 0, otHours: 0, nightDiffHours: 0, adjustments: [], attendance: { "2026-11-04": 1 } };
    expect(computeLine({ ...base, restDates: [] }, ctx).premiumPay).toBe(0);
    expect(computeLine({ ...base, restDates: ["2026-11-04"] }, ctx).premiumPay).toBe(180);
  });
});
