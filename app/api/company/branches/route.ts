import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { createBranch, updateBranch, deleteBranch, type BranchInput } from "@/lib/branches";

// Subscriber-side branch CRUD, scoped to the caller's own company (or, for
// an admin, the company they're currently acting inside — see
// lib/adminActingAs.ts). Only a Manager-level capability (canApprove) may
// edit; a plain admin manages branches from /admin/companies instead.
async function requireManagerCompany(): Promise<string | null> {
  const companyId = await effectiveCompanyId();
  if (!companyId) return null;
  const cap = await getCurrentCapability();
  return cap?.canApprove ? companyId : null;
}

function reply(r: { status: number; error?: string; branch?: unknown; ok?: boolean }) {
  return NextResponse.json(r.error ? { error: r.error } : { branch: r.branch, ok: r.ok }, { status: r.status });
}

export async function POST(request: NextRequest) {
  const companyId = await requireManagerCompany();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as BranchInput;
  return reply(await createBranch(companyId, raw));
}

export async function PATCH(request: NextRequest) {
  const companyId = await requireManagerCompany();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as BranchInput;
  return reply(await updateBranch(companyId, raw));
}

export async function DELETE(request: NextRequest) {
  const companyId = await requireManagerCompany();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as { branchId?: string };
  return reply(await deleteBranch(companyId, raw.branchId));
}
