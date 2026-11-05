import { NextRequest, NextResponse } from "next/server";
import { getPortalEmployee } from "@/lib/leavePortal";
import { fileReimbursement } from "@/lib/payroll/reimbursementServer";

// Employee files a reimbursement with receipt photos from the portal. Always
// PENDING: it goes to Payroll › Reimbursements for approval.
export async function POST(request: NextRequest) {
  const emp = await getPortalEmployee();
  if (!emp) return NextResponse.json({ error: "Please sign in again.", signin: true }, { status: 401 });
  const body = (await request.json().catch(() => null)) ?? {};
  const r = await fileReimbursement(emp.companyId, emp.id, null, body, { viaPortal: true });
  return NextResponse.json(r.error ? { error: r.error } : { ok: true }, { status: r.status });
}
