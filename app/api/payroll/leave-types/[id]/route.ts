import { NextRequest, NextResponse } from "next/server";
import { saveLeaveType } from "@/lib/payroll/leaveServer";
import { payrollAuth } from "@/lib/payroll/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await saveLeaveType(auth.companyId, params.id, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { leaveType: r.record }, { status: r.status });
}
