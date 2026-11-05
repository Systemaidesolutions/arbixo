import { describe, it, expect } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, totpStep, verifyTotp } from "./totp";

// RFC 6238 test secret "12345678901234567890" (ASCII), SHA1.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from([1, 2, 3, 250, 251, 252, 0, 9]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("matches the RFC 6238 vectors (last 6 digits)", () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCode(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
  });

  it("accepts the current and adjacent step, rejects others and reuse", () => {
    const at = new Date(1_800_000_000_000);
    const step = totpStep(at);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { at })).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { at })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 3), { at })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { at, lastStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", { at })).toBeNull();
  });
});
