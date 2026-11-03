import { NextRequest, NextResponse } from "next/server";
import { savePayItem } from "@/lib/payroll/masters";
import { payrollAuth } from "@/lib/payroll/server";

export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await savePayItem(auth.companyId, null, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { payItem: r.record }, { status: r.status });
}
