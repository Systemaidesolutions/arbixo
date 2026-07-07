import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { createBranch, updateBranch, deleteBranch, type BranchInput } from "@/lib/branches";

// Admin CRUD for a company's branches (Location rows). Branches tag where an
// entry originated and drive per-branch BIR reports + their upload filenames.

function reply(r: { status: number; error?: string; branch?: unknown; ok?: boolean }) {
  return NextResponse.json(r.error ? { error: r.error } : { branch: r.branch, ok: r.ok }, { status: r.status });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as BranchInput;
  return reply(await createBranch(params.id, raw));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as BranchInput;
  return reply(await updateBranch(params.id, raw));
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as { branchId?: string };
  return reply(await deleteBranch(params.id, raw.branchId));
}
