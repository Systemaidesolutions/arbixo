import { NextRequest, NextResponse } from "next/server";
import { saveProfile } from "@/lib/payroll/masters";
import { payrollAuth } from "@/lib/payroll/server";

export async function PUT(request: NextRequest, { params }: { params: { employeeId: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await saveProfile(auth.companyId, params.employeeId, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { profile: r.record }, { status: r.status });
}
