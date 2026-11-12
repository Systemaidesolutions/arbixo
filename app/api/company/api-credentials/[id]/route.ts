import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId, getCurrentCapability, getCurrentUserRecord } from "@/lib/currentUser";
import { revokeApiCredential } from "@/lib/apiCredentials";
import { logAudit, getClientIp } from "@/lib/audit";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) return NextResponse.json({ error: "Only a Manager can revoke an API key." }, { status: 403 });

  const revoked = await revokeApiCredential(companyId, params.id);
  if (!revoked) return NextResponse.json({ error: "Key not found." }, { status: 404 });

  const user = await getCurrentUserRecord();
  await logAudit({ companyId, username: user?.email ?? "", action: "Revoked an API key", ipAddress: getClientIp(request) });
  return NextResponse.json({ ok: true });
}
