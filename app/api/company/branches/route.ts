import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { createBranch, updateBranch, deleteBranch, type BranchInput } from "@/lib/branches";

// Subscriber-side branch CRUD, scoped to the caller's own company. Only a
// Manager (canApprove) may edit; admins manage branches from /admin/companies.
async function requireManagerCompany(): Promise<string | null> {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) return null;
  const cap = capabilitiesFor(user.role, user.subscriberSubtype);
  return cap.canApprove ? user.companyId : null;
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
