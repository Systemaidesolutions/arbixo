import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import type { Company, User } from "@prisma/client";
import { capabilitiesFor, type Capability } from "@/lib/permissions";
import { setAuditActor } from "@/lib/auditContext";
import { hasActiveSubscription } from "@/lib/subscription";

/**
 * The JWT session payload only carries id/email/role — enough for
 * display, not enough to know a subscriber's company (which can change
 * after the token was issued, e.g. right after they create their
 * company). This does one Prisma lookup to get the authoritative row.
 * Returns null if there's no valid session at all.
 */
export const getCurrentUserRecord = cache(async (): Promise<User | null> => {
  const session = await getCurrentUser();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  // Record who's acting so the audit extension (lib/prisma.ts) can attribute
  // any writes made later in this request.
  if (user) setAuditActor({ userId: user.id, email: user.email, companyId: user.companyId });
  return user;
});

/**
 * The multi-tenant boundary. ADMIN users (Arbixo staff) never have a
 * company — this always returns null for them, by design, not as a bug.
 * USER (subscriber) accounts get exactly the one company their
 * `companyId` points to, or null if they haven't set one up yet (which
 * every company-scoped page already has to handle, since that used to
 * be "no company exists yet" before multi-tenancy and the UI for it
 * already exists).
 */
export const getCurrentCompany = cache(async (): Promise<Company | null> => {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) return null;
  return prisma.company.findUnique({ where: { id: user.companyId } });
});

/**
 * Guard for admin-only pages (User List, Company List, admin
 * dashboard). Redirects anyone who isn't ADMIN back to the subscriber
 * home page rather than rendering platform-wide data they shouldn't see
 * — middleware.ts only checks "is there a valid session," not role, so
 * this is the actual authorization boundary for admin routes.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }
  return user;
}

/**
 * API-route counterpart to requireAdmin. Returns the admin user, or null
 * if the caller isn't a signed-in admin — the route then replies with a
 * 403 JSON body itself (route handlers can't use `redirect()` cleanly the
 * way page components can).
 */
export async function getAdminUser(): Promise<User | null> {
  const user = await getCurrentUserRecord();
  return user && user.role === "ADMIN" ? user : null;
}

/** Capabilities of the current user, derived from role + subscriber subtype. */
export async function getCurrentCapability(): Promise<Capability | null> {
  const user = await getCurrentUserRecord();
  if (!user) return null;
  return capabilitiesFor(user.role, user.subscriberSubtype);
}

/**
 * Like getCurrentCompany, but for the transaction-posting screens: a user
 * who can't post (Report Creator, or an admin) is redirected away rather
 * than shown a form they can't submit. Returns null only when the poster
 * has no company set up yet.
 */
export async function requirePostingCompany(): Promise<Company | null> {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const capability = capabilitiesFor(user.role, user.subscriberSubtype);
  if (!capability.canPost) redirect("/");
  if (!user.companyId) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companyId } });
  // No active subscription -> bounce to the dashboard (which explains why).
  if (company && !hasActiveSubscription(company.subscriptionEndsAt)) {
    redirect("/");
  }
  return company;
}

export type PosterResult =
  | { ok: true; user: User; capability: Capability }
  | { ok: false; status: number; error: string };

/**
 * Authorizes a transaction-mutating request against the signed-in user.
 * Also closes a gap where routes trusted companyId from the request body:
 * a subscriber can only act on their OWN company. `need` selects which
 * capability the action requires (post / cancel / approve).
 */
export async function resolvePoster(
  companyId: string,
  need: "canPost" | "canCancel" | "canApprove" = "canPost"
): Promise<PosterResult> {
  const user = await getCurrentUserRecord();
  if (!user) return { ok: false, status: 401, error: "Not signed in." };
  if (user.role !== "USER") {
    return { ok: false, status: 403, error: "Only subscriber accounts can work on a company's books." };
  }
  if (!user.companyId) {
    return { ok: false, status: 403, error: "Your account isn't assigned to a company yet." };
  }
  if (user.companyId !== companyId) {
    return { ok: false, status: 403, error: "You can only act on your own company's records." };
  }
  const capability = capabilitiesFor(user.role, user.subscriberSubtype);
  if (!capability[need]) {
    const reason =
      need === "canApprove"
        ? "Only a Manager can approve transactions."
        : need === "canCancel"
          ? "Your account can't cancel transactions."
          : "Your account is read-only and can't post transactions.";
    return { ok: false, status: 403, error: reason };
  }

  // Posting new transactions requires an active subscription (viewing and
  // managing existing entries does not).
  if (need === "canPost") {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { subscriptionEndsAt: true },
    });
    if (!hasActiveSubscription(company?.subscriptionEndsAt)) {
      return {
        ok: false,
        status: 403,
        error:
          "Your company doesn't have an active subscription. Contact your administrator to subscribe before posting transactions.",
      };
    }
  }

  return { ok: true, user, capability };
}
