// Whether a company currently has audit logging enabled, with a short
// in-memory cache so the check doesn't add a DB read to every write.
//
// Takes a `find` closure rather than importing the Prisma client, so both
// lib/audit.ts and the Prisma extension in lib/prisma.ts can use it without
// creating an import cycle.

type Finder = (id: string) => Promise<{ auditLogEnabled: boolean } | null>;

// Backed by globalThis so every route bundle shares ONE cache — otherwise a
// toggle in one route can't invalidate the copy the Prisma extension reads.
const globalForAudit = globalThis as unknown as {
  auditEnabledCache?: Map<string, { value: boolean; expires: number }>;
};
const cache = globalForAudit.auditEnabledCache ?? new Map<string, { value: boolean; expires: number }>();
globalForAudit.auditEnabledCache = cache;

const TTL_MS = 30_000;

export async function companyAuditEnabled(
  find: Finder,
  companyId: string | null | undefined
): Promise<boolean> {
  // Global / admin-level actions (no company) are always recorded.
  if (!companyId) return true;

  const hit = cache.get(companyId);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value = true;
  try {
    const company = await find(companyId);
    value = company?.auditLogEnabled ?? true;
  } catch {
    value = true; // fail open — don't silently drop audit on a lookup error
  }
  cache.set(companyId, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Call after toggling a company's setting so it takes effect immediately. */
export function invalidateAuditCache(companyId: string): void {
  cache.delete(companyId);
}
