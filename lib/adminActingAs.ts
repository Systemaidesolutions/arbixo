import { cookies } from "next/headers";

// Lets an ADMIN temporarily act inside one company's books — full Manager-
// level access, same as that company's own users, for support/troubleshooting.
// A plain (unsigned) cookie is fine here: it only ever takes effect for a
// user whose real session JWT already says role === "ADMIN" (checked at every
// read site), so tampering with it can't grant a non-admin, or an admin,
// access to anything they don't already have ambient authority to reach via
// the "Access" button on any company.
export const ACTING_AS_COOKIE = "arbixo_admin_acting_as";

export function getAdminActingAsCompanyId(): string | null {
  return cookies().get(ACTING_AS_COOKIE)?.value ?? null;
}
