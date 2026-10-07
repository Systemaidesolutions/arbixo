import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { User, Company } from "@prisma/client";

// Lets a USER (subscriber) account work across more than one company —
// e.g. an outsourced bookkeeper handling several clients — without needing
// a separate login per company. A user's PRIMARY company (User.companyId)
// is always accessible; CompanyAccess grants (managed by an admin, see
// app/api/admin/users/[id]/company-access) add any others.
//
// Mirrors lib/adminActingAs.ts in shape (a cookie holding the currently
// selected company), but the two are deliberately separate mechanisms:
// admin acting-as trusts "any admin, any company" and is validated purely
// by role; this one must check real per-user membership, so reusing the
// same cookie/logic would blur two different trust boundaries together.
export const ACTIVE_COMPANY_COOKIE = "arbixo_active_company";

/**
 * Every company id this user can work in: their primary company plus any
 * CompanyAccess grants. Cached per request.
 */
export const getAccessibleCompanyIds = cache(async (userId: string, primaryCompanyId: string | null): Promise<string[]> => {
  const grants = await prisma.companyAccess.findMany({ where: { userId }, select: { companyId: true } });
  const ids = grants.map((g) => g.companyId);
  if (primaryCompanyId && !ids.includes(primaryCompanyId)) ids.unshift(primaryCompanyId);
  return ids;
});

/** Full company rows (id + display fields) this user can switch between, primary first. */
export async function getAccessibleCompanies(userId: string, primaryCompanyId: string | null): Promise<Company[]> {
  const ids = await getAccessibleCompanyIds(userId, primaryCompanyId);
  if (ids.length === 0) return [];
  const companies = await prisma.company.findMany({ where: { id: { in: ids } } });
  const byId = new Map(companies.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter((c): c is Company => !!c);
}

/**
 * The company a USER account is actually working in for this request: the
 * active-company cookie if it's set AND the user actually has access to
 * that company, otherwise their primary company. Never trusts the cookie
 * value blindly — a stale grant (revoked after the cookie was set) or a
 * tampered value silently falls back rather than granting access.
 */
export const resolveActiveCompanyId = cache(async (user: User): Promise<string | null> => {
  const cookieCompanyId = cookies().get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  if (!cookieCompanyId || cookieCompanyId === user.companyId) return user.companyId;
  const allowed = await prisma.companyAccess.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: cookieCompanyId } },
    select: { companyId: true },
  });
  return allowed ? cookieCompanyId : user.companyId;
});

export function setActiveCompanyCookie(response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } }, companyId: string) {
  response.cookies.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // A browsing-session-length cookie (not the short 4h admin acting-as
    // window) — a bookkeeper working across clients switches routinely,
    // not just for occasional support access.
    maxAge: 60 * 60 * 24 * 30,
  });
}
