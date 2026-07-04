import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { restoreCompanyBackup, RestoreError } from "@/lib/restore";
import { logAudit, getClientIp } from "@/lib/audit";

// Overwrite a company from an uploaded per-company backup. Restore is an
// admin-only operation (it overwrites live data); subscribers can back up but
// not restore.
export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const backup = await request.json().catch(() => null);
  if (!backup) return NextResponse.json({ error: "Invalid or unreadable backup file." }, { status: 400 });

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
