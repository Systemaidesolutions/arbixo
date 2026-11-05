// Pure rules for the employee leave portal (unit-tested). Server code lives in
// lib/leavePortal.ts.
import { randomBytes, randomInt } from "node:crypto";

export const PORTAL_MAX_FAILED = 5;
export const PORTAL_LOCK_MINUTES = 15;

/** PINs are 4–6 digits. */
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,6}$/.test(pin);
}

/** Random 6-digit PIN for "Generate PIN". */
export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Unguessable code for the company's portal link: 10 chars, no look-alikes. */
export function generatePortalCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

/**
 * After a wrong PIN: the new failed count, and a lock time once it reaches
 * PORTAL_MAX_FAILED (the count then starts over for the next round).
 */
export function afterWrongPin(failed: number, now: Date = new Date()): { failed: number; lockedUntil: Date | null } {
  const next = failed + 1;
  if (next >= PORTAL_MAX_FAILED) return { failed: 0, lockedUntil: new Date(now.getTime() + PORTAL_LOCK_MINUTES * 60_000) };
  return { failed: next, lockedUntil: null };
}

export function isLocked(lockedUntil: Date | null | undefined, now: Date = new Date()): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}
