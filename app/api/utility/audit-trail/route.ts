import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord, effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";
import { getAuditTrail } from "@/lib/audit";

// Audit trail — a platform admin (not acting inside a company) sees
// any/all companies; a Manager, or an admin acting inside a company (see
// lib/adminActingAs.ts), sees only that one company. Everyone else denied.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isAdmin = user.role === "ADMIN" && !getAdminActingAsCompanyId();
  const scopedCompanyId = await effectiveCompanyId();
  const cap = await getCurrentCapability();
  const isManager = !!scopedCompanyId && !!cap?.canApprove;
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let companyId: string | undefined;
  if (isAdmin) {
    companyId = request.nextUrl.searchParams.get("company") || undefined;
  } else {
    // Manager (or admin acting-as): locked to their one company.
    if (!scopedCompanyId) return NextResponse.json({ rows: [] });
    companyId = scopedCompanyId;
  }

  const rows = await getAuditTrail({ companyId });
  return NextResponse.json({ rows });
}
