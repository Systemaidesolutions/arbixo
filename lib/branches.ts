import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Shared create/update/delete for a company's branches (Location rows), used by
// both the admin route (/api/admin/companies/[id]/branches) and the subscriber
// manager route (/api/company/branches). Callers do their own authorization
// and pass the resolved companyId.

export type BranchInput = {
  branchId?: string;
  name?: string;
  address?: string | null;
  tin?: string | null;
  branchCode?: string | null;
  isDefault?: boolean;
};

export type BranchResult = { status: number; error?: string; branch?: unknown; ok?: boolean };

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;
// Branch code: stored as 5 digits (head office 00000). Keep digits only, cap at
// 5, left-pad short entries with zeros; blank -> null.
const codeOf = (v: string | null | undefined) => {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 5);
  return d ? d.padStart(5, "0") : null;
};

// Only one branch per company may be the default.
async function clearOtherDefaults(companyId: string, keepId?: string) {
  await prisma.location.updateMany({
    where: { companyId, isDefault: true, ...(keepId ? { id: { not: keepId } } : {}) },
    data: { isDefault: false },
  });
}

export async function createBranch(companyId: string, raw: BranchInput): Promise<BranchResult> {
  const name = (raw.name ?? "").trim();
  if (!name) return { status: 400, error: "Branch name is required." };
  try {
    const branch = await prisma.location.create({
      data: {
        companyId,
        name,
        address: clean(raw.address),
        tin: clean(raw.tin),
        branchCode: codeOf(raw.branchCode),
        isDefault: Boolean(raw.isDefault),
      },
    });
    if (branch.isDefault) await clearOtherDefaults(companyId, branch.id);
    return { status: 200, branch };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return { status: 409, error: "A branch with that name already exists." };
    }
    throw e;
  }
}

export async function updateBranch(companyId: string, raw: BranchInput): Promise<BranchResult> {
  if (!raw.branchId) return { status: 400, error: "branchId is required." };
  if ("name" in raw && !(raw.name ?? "").trim()) return { status: 400, error: "Branch name is required." };

  const existing = await prisma.location.findFirst({
    where: { id: raw.branchId, companyId },
    select: { id: true },
  });
  if (!existing) return { status: 404, error: "Branch not found." };

  const data: Prisma.LocationUncheckedUpdateInput = {};
  if ("name" in raw) data.name = (raw.name ?? "").trim();
  if ("address" in raw) data.address = clean(raw.address);
  if ("tin" in raw) data.tin = clean(raw.tin);
  if ("branchCode" in raw) data.branchCode = codeOf(raw.branchCode);
  if (typeof raw.isDefault === "boolean") data.isDefault = raw.isDefault;

  try {
    const branch = await prisma.location.update({ where: { id: raw.branchId }, data });
    if (branch.isDefault) await clearOtherDefaults(companyId, branch.id);
    return { status: 200, branch };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return { status: 409, error: "A branch with that name already exists." };
    }
    throw e;
  }
}

export async function deleteBranch(companyId: string, branchId?: string): Promise<BranchResult> {
  if (!branchId) return { status: 400, error: "branchId is required." };
  const branch = await prisma.location.findFirst({
    where: { id: branchId, companyId },
    select: { id: true, _count: { select: { ledgerEntries: true } } },
  });
  if (!branch) return { status: 404, error: "Branch not found." };
  if (branch._count.ledgerEntries > 0) {
    return { status: 409, error: "This branch has posted entries and can't be deleted. Keep it for reporting." };
  }
  await prisma.location.delete({ where: { id: branchId } });
  return { status: 200, ok: true };
}
