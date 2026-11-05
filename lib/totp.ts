// Time-based one-time passwords (RFC 6238) for authenticator apps such as
// Google Authenticator, Microsoft Authenticator or Authy: HMAC-SHA1, 30-second
// steps, 6 digits. Written on node:crypto so there's no extra dependency.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_MAX_FAILED = 5;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random 160-bit secret, base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpStep(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/** The 6-digit code for a given step. */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return bin.toString().padStart(6, "0");
}

/**
 * Checks a code against the current step and one step either side (clock
 * drift). Returns the matching step, so the caller can store it and refuse
 * the same code twice, or null when it doesn't match. Codes at or before
 * `lastStep` are rejected.
 */
export function verifyTotp(
  secret: string,
  code: string,
  opts: { at?: Date; lastStep?: number | null } = {}
): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = totpStep(opts.at);
  for (const step of [now, now - 1, now + 1]) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    const expected = totpCode(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return step;
  }
  return null;
}

/** otpauth:// URI that authenticator apps read from the QR code. */
export function totpUri(secret: string, account: string, issuer = "ARbixo"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}
