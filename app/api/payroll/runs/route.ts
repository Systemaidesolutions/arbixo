import { NextRequest, NextResponse } from "next/server";
import { createRun, payrollAuth } from "@/lib/payroll/server";

export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await createRun(auth.companyId, auth.userId, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { run: r.run }, { status: r.status });
}
