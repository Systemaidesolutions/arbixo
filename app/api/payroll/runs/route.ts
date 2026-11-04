import { NextRequest, NextResponse } from "next/server";
import { createRun, payrollAuth } from "@/lib/payroll/server";
import { payrollSubscriptionProblem } from "@/lib/payroll/subscription";

export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) ?? {};
  if (!auth.isAdmin && body.payDate) {
    const thirteenth = body.kind === "THIRTEENTH_MONTH";
    const year = Number(body.year) || Number(String(body.payDate).slice(0, 4));
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const start = thirteenth ? `${year}-01-01` : body.periodStart;
    const end = thirteenth ? `${year}-12-31` : body.periodEnd;
    if (start && end && !isNaN(d(start).getTime()) && !isNaN(d(end).getTime()) && end >= start) {
      const problem = await payrollSubscriptionProblem(auth.companyId, { kind: thirteenth ? "THIRTEENTH_MONTH" : "REGULAR", periodStart: d(start), periodEnd: d(end), payDate: d(body.payDate) });
      if (problem) return NextResponse.json({ error: problem }, { status: 402 });
    }
  }
  const r = await createRun(auth.companyId, auth.userId, body);
  return NextResponse.json(r.error ? { error: r.error } : { run: r.run }, { status: r.status });
}
