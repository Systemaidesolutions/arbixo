import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { restoreDatabaseBackup, RestoreError } from "@/lib/restore";
import { logAudit, getClientIp } from "@/lib/audit";

// Overwrite every company + shared ATC codes from a whole-database backup.
// Admin only. User accounts are never modified (so no one is locked out).
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const backup = await request.json().catch(() => null);
  if (!backup) return NextResponse.json({ error: "Invalid or unreadable backup file." }, { status: 400 });

  try {
    const { companies } = await restoreDatabaseBackup(backup);
    await logAudit({
      companyId: null,
      username: admin.email,
      action: `Restored whole database from backup (${companies} companies, overwrite)`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ ok: true, companies });
  } catch (err) {
    if (err instanceof RestoreError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[restore] database restore failed:", err);
    return NextResponse.json({ error: "Restore failed. No changes were committed." }, { status: 500 });
  }
}
