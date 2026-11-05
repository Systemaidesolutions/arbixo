import { NextRequest, NextResponse } from "next/server";
import { getPortalEmployee } from "@/lib/leavePortal";
import { fileLeave } from "@/lib/payroll/leaveServer";

// Employee files their own leave from the portal. Always PENDING: it goes to
// Payroll › Leave for approval, with the same credit/overlap checks as staff.
export async function POST(request: NextRequest) {
  const emp = await getPortalEmployee();
  if (!emp) return NextResponse.json({ error: "Please sign in again.", signin: true }, { status: 401 });
  const body = (await request.json().catch(() => null)) ?? {};
  const r = await fileLeave(
    emp.companyId,
    null,
    {
      employeeId: emp.id,
      leaveTypeId: body.leaveTypeId,
      startDate: body.startDate,
      endDate: body.endDate,
      halfDay: body.halfDay === true,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
    },
    { viaPortal: true }
  );
  return NextResponse.json(r.error ? { error: r.error } : { ok: true }, { status: r.status });
}
