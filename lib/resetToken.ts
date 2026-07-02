import crypto from "crypto";

// Password-reset tokens. The raw token goes in the emailed link; only its
// SHA-256 hash is stored, so a leaked DB row can't be turned into a working
// reset link. Kept in its own file (not lib/auth.ts) because lib/auth.ts is
// imported by the Edge middleware, which can't bundle node:crypto.
export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
