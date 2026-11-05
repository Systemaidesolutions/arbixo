import { describe, it, expect } from "vitest";
import { isNightLoginPH, phHour } from "./loginAlert";

// PH = UTC+8, so 12:00 UTC is 8:00 PM PH and 20:00 UTC is 4:00 AM PH.
const utc = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 5, h, m));

describe("isNightLoginPH", () => {
  it("converts to Philippine hour", () => {
    expect(phHour(utc(0))).toBe(8);
    expect(phHour(utc(16))).toBe(0);
  });
  it("flags 8:00 PM to 3:59 AM PH", () => {
    expect(isNightLoginPH(utc(12, 0))).toBe(true); // 8:00 PM
    expect(isNightLoginPH(utc(16, 30))).toBe(true); // 12:30 AM
    expect(isNightLoginPH(utc(19, 59))).toBe(true); // 3:59 AM
  });
  it("does not flag daytime", () => {
    expect(isNightLoginPH(utc(11, 59))).toBe(false); // 7:59 PM
    expect(isNightLoginPH(utc(20, 0))).toBe(false); // 4:00 AM
    expect(isNightLoginPH(utc(2))).toBe(false); // 10:00 AM
  });
});
