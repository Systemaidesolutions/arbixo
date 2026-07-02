import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/auth";

/**
 * Reads and verifies the session cookie. Returns the JWT payload
 * directly (id/email/role) rather than querying the User table — this
 * is enough for anything the UI needs to display (who's logged in, are
 * they an admin) without an extra database round trip on every page
 * load. If a page ever needs fresher user data (e.g. after a profile
 * edit), query Prisma directly there instead of extending this.
 */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
