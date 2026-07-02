import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { buildDatabaseBackup } from "@/lib/backup";

// Whole-database backup — admin only.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await buildDatabaseBackup();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `arbixo-backup-database-${date}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
