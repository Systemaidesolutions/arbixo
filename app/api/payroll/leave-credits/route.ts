import { NextRequest, NextResponse } from "next/server";
import { saveCredit } from "@/lib/payroll/leaveServer";
import { payrollAuth } from "@/lib/payroll/server";

// Manual edit of one employee's credits: { employeeId, leaveTypeId, year, granted, carriedOver, adjustment, remarks }.
export async function PUT(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await saveCredit(auth.companyId, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { credit: r.record }, { status: r.status });
}
