import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { syncStandardChartForCompany, resetCompanyToStandardChart } from "@/lib/seedChart";

// Aligns ONE company's chart of accounts to the standard chart
// (lib/defaultChartOfAccounts.ts) — scoped to a company the admin picks in
// the request body, never every company at once. Two modes:
//   "sync"  (default) — additive only: adds any missing standard accounts,
//           never deletes or overwrites anything that already exists.
//   "reset" — deletes the company's entire chart first, then rebuilds it
//           from only the standard chart. Anything still in use (ledger
//           entries, a child account, a tax-posting-setup reference) can't
//           be deleted and is reported back instead, so real transaction
//           history is never destroyed.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { companyId?: string; mode?: "sync" | "reset" } | null;
  const companyId = body?.companyId;
  const mode = body?.mode === "reset" ? "reset" : "sync";
  if (!companyId) return NextResponse.json({ error: "Pick a company first." }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, tradeName: true } });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  setAuditSuppressed(true);
  try {
    const result =
      mode === "reset"
        ? await resetCompanyToStandardChart(company.id, company.tradeName)
        : await syncStandardChartForCompany(company.id, company.tradeName);
    return NextResponse.json({ ok: true, mode, result });
  } catch (err) {
    console.error("[admin standard-chart] failed:", err);
    return NextResponse.json({ error: "Could not update the chart of accounts." }, { status: 500 });
  } finally {
    setAuditSuppressed(false);
  }
}
