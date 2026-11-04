import { NextRequest, NextResponse } from "next/server";
import { fileLeave } from "@/lib/payroll/leaveServer";
import { payrollAuth } from "@/lib/payroll/server";

// Files a leave for an employee (entered by payroll staff).
export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await fileLeave(auth.companyId, auth.userId, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { leave: r.record }, { status: r.status });
}
