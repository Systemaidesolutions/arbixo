import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import type { Company } from "@prisma/client";

/**
 * The company the current (app)-area page should operate on.
 *
 * Subscribers are scoped to their own companyId from the session. This
 * REPLACES the old `prisma.company.findFirst()` pattern, which returned
 * "the one and only company" and is unsafe now that multiple companies
 * subscribe — findFirst would leak one tenant's books to another.
 *
 * MIGRATION NOTE: the transaction, report, and setup pages under
 * app/(app) still call prisma.company.findFirst() directly. Each should
 * be switched to this helper (and their API routes to resolveCompanyId
 * in lib/authz.ts) so every query is tenant-scoped. Tracked as the
 * follow-up to the user/company restructure — not done in this pass to
 * avoid a partial, silently-broken migration across ~17 call sites.
 */
export async function getScopedCompany(): Promise<Company | null> {
  const user = await getCurrentUser();
  if (!user?.companyId) return null;
  return prisma.company.findUnique({ where: { id: user.companyId } });
}
