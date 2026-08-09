import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { resetAllCompaniesToStandardChart } from "@/lib/seedChart";

// Wipes every company's chart of accounts and rebuilds it from only the
// standard chart (lib/defaultChartOfAccounts.ts) — no old codes carried
// over. Any account a Postgres FK constraint refuses to delete (it still
// has ledger entries, a child account, or a tax-posting-setup reference) is
// left in place and reported back for manual review in the Chart of
// Accounts screen, so real transaction history is never destroyed.
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  setAuditSuppressed(true);
  try {
    const results = await resetAllCompaniesToStandardChart();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[admin standard-chart reset] failed:", err);
    return NextResponse.json({ error: "Could not reset the chart of accounts." }, { status: 500 });
  } finally {
    setAuditSuppressed(false);
  }
}
