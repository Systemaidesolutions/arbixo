import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import type { Prisma } from "@prisma/client";

// Admin CRUD for a company's branches (Location rows). Branches tag where an
// entry originated and drive per-branch BIR reports + their upload filenames.

type BranchPayload = {
  branchId?: string;
  name?: string;
  address?: string | null;
  tin?: string | null;
  branchCode?: string | null;
  isDefault?: boolean;
};

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;

// Builds the update/create data shared by POST and PATCH from a payload.
function branchData(raw: BranchPayload): Prisma.LocationUncheckedUpdateInput {
  const data: Prisma.LocationUncheckedUpdateInput = {};
  if ("name" in raw) data.name = (raw.name ?? "").trim();
  if ("address" in raw) data.address = clean(raw.address);
  if ("tin" in raw) data.tin = clean(raw.tin);
  // Branch code: keep digits only (BIR uses 3 or 5), blank -> null.
  if ("branchCode" in raw) data.branchCode = (raw.branchCode ?? "").replace(/\D/g, "") || null;
  return data;
}

// When a branch is set as default, no other branch of the company may be.
async function clearOtherDefaults(companyId: string, keepId?: string) {
  await prisma.location.updateMany({
    where: { companyId, isDefault: true, ...(keepId ? { id: { not: keepId } } : {}) },
    data: { isDefault: false },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as BranchPayload | null;
  const name = (raw?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Branch name is required." }, { status: 400 });

  try {
    const branch = await prisma.location.create({
      data: {
        companyId: params.id,
        name,
        address: clean(raw?.address),
        tin: clean(raw?.tin),
        branchCode: (raw?.branchCode ?? "").replace(/\D/g, "") || null,
        isDefault: Boolean(raw?.isDefault),
      },
    });
    if (branch.isDefault) await clearOtherDefaults(params.id, branch.id);
    return NextResponse.json({ branch });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A branch with that name already exists." }, { status: 409 });
    }
    throw e;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as BranchPayload | null;
  if (!raw?.branchId) return NextResponse.json({ error: "branchId is required." }, { status: 400 });
  if ("name" in raw && !(raw.name ?? "").trim()) {
    return NextResponse.json({ error: "Branch name is required." }, { status: 400 });
  }

  const existing = await prisma.location.findFirst({
    where: { id: raw.branchId, companyId: params.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Branch not found." }, { status: 404 });

  const data = branchData(raw);
  if (typeof raw.isDefault === "boolean") data.isDefault = raw.isDefault;

  try {
    const branch = await prisma.location.update({ where: { id: raw.branchId }, data });
    if (branch.isDefault) await clearOtherDefaults(params.id, branch.id);
    return NextResponse.json({ branch });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A branch with that name already exists." }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as { branchId?: string } | null;
  if (!raw?.branchId) return NextResponse.json({ error: "branchId is required." }, { status: 400 });

  const branch = await prisma.location.findFirst({
    where: { id: raw.branchId, companyId: params.id },
    select: { id: true, _count: { select: { ledgerEntries: true } } },
  });
  if (!branch) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
  if (branch._count.ledgerEntries > 0) {
    return NextResponse.json(
      { error: "This branch has posted entries and can't be deleted. Keep it for reporting." },
      { status: 409 }
    );
  }

  await prisma.location.delete({ where: { id: raw.branchId } });
  return NextResponse.json({ ok: true });
}
