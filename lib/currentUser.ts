import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import type { Company, User } from "@prisma/client";

/**
 * The JWT session payload only carries id/email/role — enough for
 * display, not enough to know a subscriber's company (which can change
 * after the token was issued, e.g. right after they create their
 * company). This does one Prisma lookup to get the authoritative row.
 * Returns null if there's no valid session at all.
 */
export async function getCurrentUserRecord(): Promise<User | null> {
  const session = await getCurrentUser();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.sub } });
}

/**
 * The multi-tenant boundary. ADMIN users (Arbixo staff) never have a
 * company — this always returns null for them, by design, not as a bug.
 * USER (subscriber) accounts get exactly the one company their
 * `companyId` points to, or null if they haven't set one up yet (which
 * every company-scoped page already has to handle, since that used to
 * be "no company exists yet" before multi-tenancy and the UI for it
 * already exists).
 */
export async function getCurrentCompany(): Promise<Company | null> {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) return null;
  return prisma.company.findUnique({ where: { id: user.companyId } });
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
    redirect("/");
  }
  return user;
}
