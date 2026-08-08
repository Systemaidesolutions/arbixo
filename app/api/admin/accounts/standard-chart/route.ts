import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { syncStandardChartForAllCompanies } from "@/lib/seedChart";

// Applies the standard chart of accounts (lib/defaultChartOfAccounts.ts) to
// every company: adds any missing standard codes and reports codes that
// already exist under a different title so an admin can review them in the
// Chart of Accounts screen. Never deletes or overwrites an existing account.
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  setAuditSuppressed(true);
  try {
    const results = await syncStandardChartForAllCompanies();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[admin standard-chart sync] failed:", err);
    return NextResponse.json({ error: "Could not sync the standard chart." }, { status: 500 });
  } finally {
    setAuditSuppressed(false);
  }
}
