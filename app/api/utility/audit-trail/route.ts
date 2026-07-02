import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { getAuditTrail } from "@/lib/audit";

// Audit trail — admins see any/all companies; a Manager sees only their
// own company. Everyone else is denied.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isAdmin = user.role === "ADMIN";
  const isManager = capabilitiesFor(user.role, user.subscriberSubtype).canApprove;
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let companyId: string | undefined;
  if (isAdmin) {
    companyId = request.nextUrl.searchParams.get("company") || undefined;
  } else {
    // Manager: locked to their own company.
    if (!user.companyId) return NextResponse.json({ rows: [] });
    companyId = user.companyId;
  }

  const rows = await getAuditTrail({ companyId });
  return NextResponse.json({ rows });
}
