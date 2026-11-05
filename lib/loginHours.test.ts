import { describe, it, expect } from "vitest";
import { describeLoginHours, isWithinLoginHours, type LoginHours } from "./loginHours";

// 2026-11-02 is a Monday. PH = UTC+8: phTime(day, h, m) builds that PH moment.
const phTime = (dayOffset: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, 2 + dayOffset, h - 8, m));

const office: LoginHours = { loginHoursEnabled: true, loginStart: "08:00", loginEnd: "20:00", loginDays: [1, 2, 3, 4, 5, 6] };

describe("isWithinLoginHours", () => {
  it("is always true when off", () => {
    expect(isWithinLoginHours({ ...office, loginHoursEnabled: false }, phTime(0, 2))).toBe(true);
  });
  it("respects the daytime window and days", () => {
    expect(isWithinLoginHours(office, phTime(0, 8))).toBe(true); // Mon 8:00 AM
    expect(isWithinLoginHours(office, phTime(0, 19, 59))).toBe(true);
    expect(isWithinLoginHours(office, phTime(0, 20))).toBe(false); // Mon 8:00 PM
    expect(isWithinLoginHours(office, phTime(0, 7, 59))).toBe(false);
    expect(isWithinLoginHours(office, phTime(6, 10))).toBe(false); // Sunday
  });
  it("handles a window crossing midnight", () => {
    const night: LoginHours = { loginHoursEnabled: true, loginStart: "22:00", loginEnd: "06:00", loginDays: [1] };
    expect(isWithinLoginHours(night, phTime(0, 23))).toBe(true); // Mon 11 PM
    expect(isWithinLoginHours(night, phTime(1, 5))).toBe(true); // Tue 5 AM, started Mon
    expect(isWithinLoginHours(night, phTime(1, 23))).toBe(false); // Tue 11 PM
    expect(isWithinLoginHours(night, phTime(0, 5))).toBe(false); // Mon 5 AM, started Sun
  });
  it("describes the window", () => {
    expect(describeLoginHours(office)).toBe("Mon–Sat, 8:00 AM – 8:00 PM (PH time)");
  });
});
