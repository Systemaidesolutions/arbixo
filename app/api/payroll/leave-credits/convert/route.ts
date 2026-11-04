import { NextRequest, NextResponse } from "next/server";
import { convertLeave } from "@/lib/payroll/leaveServer";
import { payrollAuth } from "@/lib/payroll/server";

// Converts unused credits of a cash-convertible leave type to cash: { leaveTypeId, year, payOn, employeeIds? }.
export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await convertLeave(auth.companyId, auth.userId, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { created: r.created }, { status: r.status });
}
