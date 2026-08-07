import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import type { Company, User } from "@prisma/client";
import { capabilitiesFor, type Capability } from "@/lib/permissions";
import { setAuditActor } from "@/lib/auditContext";
import { hasActiveSubscription } from "@/lib/subscription";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";

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
  // any writes made later in this request. An admin acting inside a company
  // (see lib/adminActingAs.ts) is attributed to THAT company, not their own
  // (they have none) — this is also what the subscription-coverage check
  // reads to bypass the date restriction for admin support access.
  if (user) {
    if (user.role === "ADMIN") {
      const actingAsCompanyId = getAdminActingAsCompanyId();
      setAuditActor({
        userId: user.id,
        email: user.email,
        companyId: actingAsCompanyId,
        isAdminActingAs: !!actingAsCompanyId,
      });
    } else {
      setAuditActor({ userId: user.id, email: user.email, companyId: user.companyId });
    }
  }
  return user;
});

/**
 * The multi-tenant boundary. USER (subscriber) accounts get exactly the one
 * company their `companyId` points to, or null if they haven't set one up
 * yet. An ADMIN normally has no company (by design, not a bug) — except
 * while acting inside one for support (lib/adminActingAs.ts), in which case
 * this resolves to that company, same as it would for that company's own
 * users.
 */
export const getCurrentCompany = cache(async (): Promise<Company | null> => {
  const user = await getCurrentUserRecord();
  if (!user) return null;
  if (user.role === "USER" && user.companyId) {
    return prisma.company.findUnique({ where: { id: user.companyId } });
  }
  if (user.role === "ADMIN") {
    const actingAsCompanyId = getAdminActingAsCompanyId();
    if (actingAsCompanyId) return prisma.company.findUnique({ where: { id: actingAsCompanyId } });
  }
  return null;
});

/**
 * The company id to act on for the current request — the caller's own
 * company (USER), or the company an admin is currently acting inside
 * (lib/adminActingAs.ts). Null if neither applies. Several routes/pages
 * check `user.role !== "USER"` directly instead of going through
 * getCurrentCompany/resolvePoster/requirePostingCompany; use this there so
 * admin-acting-as gets the same access as that company's own users without
 * each call site re-deriving the logic.
 */
export async function effectiveCompanyId(): Promise<string | null> {
  const user = await getCurrentUserRecord();
  if (!user) return null;
  if (user.role === "USER") return user.companyId;
  if (user.role === "ADMIN") return getAdminActingAsCompanyId();
  return null;
}

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
    redirect("/dashboard");
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

/**
 * Capabilities of the current user, derived from role + subscriber subtype.
 * An admin acting inside a company (lib/adminActingAs.ts) gets full
 * Manager-level capabilities for that company, same as its own Manager
 * would — not the platform-only, read-only set a plain admin gets.
 */
export async function getCurrentCapability(): Promise<Capability | null> {
  const user = await getCurrentUserRecord();
  if (!user) return null;
  if (user.role === "ADMIN" && getAdminActingAsCompanyId()) {
    return capabilitiesFor("USER", "MANAGER");
  }
  return capabilitiesFor(user.role, user.subscriberSubtype);
}

/**
 * Like getCurrentCompany, but for the transaction-posting screens: a user
 * who can't post (Report Creator, or a plain admin) is redirected away
 * rather than shown a form they can't submit. Returns null only when the
 * poster has no company set up yet.
 */
export async function requirePostingCompany(): Promise<Company | null> {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");

  if (user.role === "ADMIN") {
    const actingAsCompanyId = getAdminActingAsCompanyId();
    if (!actingAsCompanyId) redirect("/dashboard");
    // No active-subscription check here — an admin's support access isn't
    // gated by the company's own subscription status.
    return prisma.company.findUnique({ where: { id: actingAsCompanyId } });
  }

  const capability = capabilitiesFor(user.role, user.subscriberSubtype);
  if (!capability.canPost) redirect("/dashboard");
  if (!user.companyId) return null;
  const company = await prisma.company.findUnique({ where: { id: user.companyId } });
  // No active subscription -> bounce to the dashboard (which explains why).
  if (company && !hasActiveSubscription(company.subscriptionEndsAt)) {
    redirect("/dashboard");
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
 * capability the action requires (post / cancel / approve). An admin
 * currently acting inside the target company (lib/adminActingAs.ts) is
 * authorized with full Manager-level capability and no active-subscription
 * requirement, same as requirePostingCompany above.
 */
export async function resolvePoster(
  companyId: string,
  need: "canPost" | "canCancel" | "canApprove" = "canPost"
): Promise<PosterResult> {
  const user = await getCurrentUserRecord();
  if (!user) return { ok: false, status: 401, error: "Not signed in." };

  if (user.role === "ADMIN") {
    const actingAsCompanyId = getAdminActingAsCompanyId();
    if (!actingAsCompanyId) {
      return { ok: false, status: 403, error: 'Not currently accessing a company — use "Access" from the Companies list.' };
    }
    if (actingAsCompanyId !== companyId) {
      return { ok: false, status: 403, error: "You can only act on the company you're currently accessing." };
    }
    return { ok: true, user, capability: capabilitiesFor("USER", "MANAGER") };
  }

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
