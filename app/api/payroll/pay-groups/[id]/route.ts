import { NextRequest, NextResponse } from "next/server";
import { savePayGroup } from "@/lib/payroll/masters";
import { payrollAuth } from "@/lib/payroll/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await savePayGroup(auth.companyId, params.id, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { payGroup: r.record }, { status: r.status });
}
