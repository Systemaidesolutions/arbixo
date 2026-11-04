import { NextRequest, NextResponse } from "next/server";
import { grantCredits } from "@/lib/payroll/leaveServer";
import { payrollAuth } from "@/lib/payroll/server";

// Grants a year's leave credits to every eligible employee: { year }.
export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = ((await request.json().catch(() => null)) ?? {}) as { year?: unknown };
  const r = await grantCredits(auth.companyId, Number(body.year));
  return NextResponse.json(r.error ? { error: r.error } : { created: r.created }, { status: r.status });
}
