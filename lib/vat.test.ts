import { describe, expect, it } from "vitest";
import { computeVat, computeWithholding, computeVatAndWithholding } from "./vat";

describe("computeVat", () => {
  it("matches the manual's Cash Disbursement example (page 16): Gross 8,000.00", () => {
    const result = computeVat({ vatType: "VAT_12", amount: 8000, amountIsGross: true });
    expect(result.grossAmount).toBe(8000);
    expect(result.netAmount).toBe(7142.86);
    expect(result.vatAmount).toBe(857.14);
  });

  it("matches the manual's Expense example (page 59): Gross 10,000.00", () => {
    const result = computeVat({ vatType: "VAT_12", amount: 10000, amountIsGross: true });
    expect(result.netAmount).toBe(8928.57);
    expect(result.vatAmount).toBe(1071.43);
  });

  it("matches the manual's Sales example (page 25): Gross 6,720.00", () => {
    const result = computeVat({ vatType: "VAT_12", amount: 6720, amountIsGross: true });
    expect(result.netAmount).toBe(6000);
    expect(result.vatAmount).toBe(720);
  });

  it("computes gross from a net entry (net-first entry mode)", () => {
    const result = computeVat({ vatType: "VAT_12", amount: 6000, amountIsGross: false });
    expect(result.grossAmount).toBe(6720);
    expect(result.vatAmount).toBe(720);
  });

  it("passes the amount through unchanged for non-12%-VAT types, per the manual's note to only fill Net Amount", () => {
    for (const vatType of ["ZERO_RATED", "VAT_EXEMPT", "NON_VAT"] as const) {
      const result = computeVat({ vatType, amount: 5000, amountIsGross: true });
      expect(result).toEqual({ grossAmount: 5000, netAmount: 5000, vatAmount: 0 });
    }
  });
});

describe("computeWithholding", () => {
  it("matches the manual's WC158 example (page 16): Net 7,142.86 × 1%", () => {
    expect(computeWithholding(7142.86, 1)).toBe(71.43);
  });

  it("matches the manual's WC160 example (page 59): Net 8,928.57 × 2%", () => {
    expect(computeWithholding(8928.57, 2)).toBe(178.57);
  });

  it("matches the manual's WV010 example (page 25): Net 6,000.00 × 5%", () => {
    expect(computeWithholding(6000, 5)).toBe(300);
  });
});

describe("computeVatAndWithholding", () => {
  it("combines both calculations in one call", () => {
    const result = computeVatAndWithholding({ vatType: "VAT_12", amount: 8000, amountIsGross: true }, 1);
    expect(result.netAmount).toBe(7142.86);
    expect(result.withholdingAmt).toBe(71.43);
  });

  it("skips withholding when no rate is supplied", () => {
    const result = computeVatAndWithholding({ vatType: "VAT_12", amount: 8000, amountIsGross: true });
    expect(result.withholdingAmt).toBe(0);
  });
});
