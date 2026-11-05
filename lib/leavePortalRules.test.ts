import { describe, it, expect } from "vitest";
import { PORTAL_MAX_FAILED, afterWrongPin, generatePin, generatePortalCode, isLocked, isValidPin } from "./leavePortalRules";

describe("leave portal rules", () => {
  it("accepts 4–6 digit PINs only", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin(1234)).toBe(false);
  });
  it("generates PINs and portal codes", () => {
    expect(generatePin()).toMatch(/^\d{6}$/);
    expect(generatePortalCode()).toMatch(/^[a-z2-9]{10}$/);
  });
  it("locks after the max wrong PINs", () => {
    const now = new Date("2026-11-05T00:00:00Z");
    let failed = 0;
    for (let i = 1; i < PORTAL_MAX_FAILED; i++) {
      const r = afterWrongPin(failed, now);
      expect(r.lockedUntil).toBeNull();
      failed = r.failed;
    }
    const last = afterWrongPin(failed, now);
    expect(last.failed).toBe(0);
    expect(isLocked(last.lockedUntil, now)).toBe(true);
    expect(isLocked(last.lockedUntil, new Date(now.getTime() + 16 * 60_000))).toBe(false);
  });
});
