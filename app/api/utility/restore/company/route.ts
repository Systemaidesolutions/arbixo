import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { restoreCompanyBackup, RestoreError } from "@/lib/restore";
import { logAudit, getClientIp } from "@/lib/audit";

// Overwrite a company from an uploaded per-company backup. Admins can
// restore any company; a Manager can restore only their own.
export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isAdmin = user.role === "ADMIN";
  const isManager = capabilitiesFor(user.role, user.subscriberSubtype).canApprove;
  if (!isAdmin && !isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const backup = await request.json().catch(() => null);
  if (!backup) return NextResponse.json({ error: "Invalid or unreadable backup file." }, { status: 400 });

  const targetId: string | undefined = backup?.company?.id;
  if (isManager && targetId !== user.companyId) {
    return NextResponse.json(
      { error: "You can only restore a backup of your own company." },
      { status: 403 }
    );
  }

  try {
    const { companyId } = await restoreCompanyBackup(backup);
    await logAudit({
      companyId,
      username: user.email,
      action: "Restored company from backup (overwrite)",
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ ok: true, companyId });
  } catch (err) {
    if (err instanceof RestoreError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[restore] company restore failed:", err);
    return NextResponse.json({ error: "Restore failed. No changes were committed." }, { status: 500 });
  }
}
