import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId, getCurrentCapability, getCurrentUserRecord } from "@/lib/currentUser";
import { createApiCredential, listApiCredentials } from "@/lib/apiCredentials";
import { logAudit, getClientIp } from "@/lib/audit";

// Subscriber-side API credential management, scoped to the caller's own
// company (or, for an admin, the company they're currently acting inside —
// same pattern as app/api/company/branches/route.ts). Only a Manager-level
// capability (canApprove) may create or revoke a key; any subscriber role
// can list (masked) to know what already exists.
async function requireCompany(): Promise<string | null> {
  return effectiveCompanyId();
}

export async function GET() {
  const companyId = await requireCompany();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  return NextResponse.json({ credentials: await listApiCredentials(companyId) });
}

export async function POST(request: NextRequest) {
  const companyId = await requireCompany();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) return NextResponse.json({ error: "Only a Manager can create an API key." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "A name for this key is required (e.g. who/what will use it)." }, { status: 400 });

  const user = await getCurrentUserRecord();
  const { credential, plaintext } = await createApiCredential(companyId, name, user?.id ?? null);
  await logAudit({ companyId, username: user?.email ?? "", action: `Created API key "${name}"`, ipAddress: getClientIp(request) });

  // The only time the plaintext key is ever returned. keyHash is deliberately
  // left out — nothing in the UI needs it, so there's no reason to send it.
  const { id, name: credentialName, keyPrefix, createdAt, lastUsedAt, revokedAt } = credential;
  return NextResponse.json({ credential: { id, name: credentialName, keyPrefix, createdAt, lastUsedAt, revokedAt }, key: plaintext }, { status: 201 });
}
