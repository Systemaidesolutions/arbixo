import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import type { SessionPayload } from "@/lib/auth";

export function isAdmin(user: Pick<SessionPayload, "userType"> | null): boolean {
  return user?.userType === "ADMIN";
}

/**
 * For server components under /admin. Returns the session if the user is
 * an ARbixo admin, otherwise redirects a subscriber back to their own
 * dashboard. middleware.ts already blocks this at the edge; this is the
 * belt-and-suspenders check so an admin page can never render for a
 * non-admin even if middleware is bypassed.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");
  return user;
}

/**
 * The company a request should operate on:
 *   - SUBSCRIBER → their own companyId (from the session, no DB hit)
 *   - ADMIN      → whatever company they're acting on, passed explicitly
 *                  (e.g. ?companyId= when drilling into one tenant)
 * Returns null when it can't be resolved, so callers can 400 rather than
 * leaking across tenants by falling back to "the first company".
 */
export function resolveCompanyId(
  user: Pick<SessionPayload, "userType" | "companyId"> | null,
  requestedCompanyId?: string | null
): string | null {
  if (!user) return null;
  if (user.userType === "SUBSCRIBER") return user.companyId ?? null;
  // Admin: trust the explicit selection.
  return requestedCompanyId ?? null;
}
