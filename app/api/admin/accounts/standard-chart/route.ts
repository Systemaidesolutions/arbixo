import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { migrateAllCompaniesToStandardChart } from "@/lib/seedChart";

// Renumbers every company's chart onto the new standard codes
// (lib/defaultChartOfAccounts.ts): untouched accounts from the old default
// seed are dropped so the new code can take their place, and the full
// standard chart is (re)created. Any account the company actually renamed,
// restructured, or posted to is left alone (a database FK constraint blocks
// its deletion) and reported back as a conflict for manual review in the
// Chart of Accounts screen.
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  setAuditSuppressed(true);
  try {
    const results = await migrateAllCompaniesToStandardChart();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[admin standard-chart migrate] failed:", err);
    return NextResponse.json({ error: "Could not migrate the standard chart." }, { status: 500 });
  } finally {
    setAuditSuppressed(false);
  }
}
