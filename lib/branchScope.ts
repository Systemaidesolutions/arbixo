import { prisma } from "@/lib/prisma";

/**
 * Branch (Location) scoping for reports.
 *
 * A report is either CONSOLIDATED (no branch chosen — every entry) or scoped to
 * one branch. Roughly half of the historical ledger was posted before branches
 * existed and carries no locationId; those entries are treated as belonging to
 * the HEAD OFFICE so that (a) a branch's statements still balance and (b) the
 * branches always add back up to the consolidated figures. Nothing is rewritten
 * in the database — this is purely how reports read it.
 */
export type BranchScope = { locationId: string; includeUntagged: boolean } | null;

const isAllZeroCode = (code: string | null) => {
  const digits = (code ?? "").replace(/\D/g, "");
  return digits.length > 0 && /^0+$/.test(digits);
};

/** Resolve a requested branch id (from a query param) into a scope. */
export async function resolveBranchScope(
  companyId: string,
  locationId?: string | null,
): Promise<BranchScope> {
  const id = (locationId ?? "").trim();
  if (!id) return null; // consolidated
  const loc = await prisma.location.findFirst({
    where: { id, companyId },
    select: { id: true, isDefault: true, branchCode: true },
  });
  if (!loc) return null; // unknown/foreign branch -> consolidated rather than empty
  return { locationId: loc.id, includeUntagged: loc.isDefault || isAllZeroCode(loc.branchCode) };
}

/**
 * Prisma `where` fragment for a scope — spread into a ledgerEntry where clause.
 * Consolidated yields {} (no filtering).
 */
export function branchWhere(scope: BranchScope) {
  if (!scope) return {};
  return scope.includeUntagged
    ? { OR: [{ locationId: scope.locationId }, { locationId: null }] }
    : { locationId: scope.locationId };
}

/** Human label for report headers, e.g. "All branches" or "00001 — Cebu". */
export async function branchScopeLabel(scope: BranchScope): Promise<string> {
  if (!scope) return "All branches (consolidated)";
  const loc = await prisma.location.findUnique({
    where: { id: scope.locationId },
    select: { name: true, branchCode: true },
  });
  if (!loc) return "All branches (consolidated)";
  const code = (loc.branchCode ?? "").trim();
  return code ? `${code} — ${loc.name}` : loc.name;
}
