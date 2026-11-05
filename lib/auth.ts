import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "arbixo_session";
const SESSION_DURATION = "7d";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET environment variable is not set. Generate one with `openssl rand -base64 32` and add it to .env."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string; // user id
  email: string;
  role: "ADMIN" | "USER";
};

/**
 * Sessions are stateless signed JWTs, not rows in a database table. This
 * is deliberate: middleware.ts checks auth on every request and runs on
 * the Edge runtime, which can't reach Postgres through Prisma. Verifying
 * a JWT's signature needs no database call, so the auth gate works
 * there. The tradeoff, stated plainly: there's no way to force-expire a
 * single session before its 7-day expiry (no revocation list). Fine for
 * now; a real "sign out everywhere" feature would need to reintroduce a
 * DB-backed denylist or session table.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.purpose) return null; // a 2FA login ticket is never a session
    return { sub: payload.sub, email: payload.email, role: payload.role as "ADMIN" | "USER" };
  } catch {
    return null;
  }
}

export function generateVerificationCode(): string {
  // 6-digit numeric code, zero-padded — matches the shape people expect
  // from "enter the code we emailed you" flows.
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

// Short-lived ticket issued after a correct password when the second factor
// is still needed. It is NOT a session: middleware never accepts it, and
// it's only exchanged at /api/auth/login/verify together with a valid code.
const TICKET_PURPOSE = "2fa-login";

export async function createLoginTicket(userId: string): Promise<string> {
  return new SignJWT({ purpose: TICKET_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());
}

export async function verifyLoginTicket(ticket: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(ticket, getSecret());
    if (payload.purpose !== TICKET_PURPOSE || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}
