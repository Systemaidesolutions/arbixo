import { NextRequest, NextResponse } from "next/server";
import { decideLeave } from "@/lib/payroll/leaveServer";
import { payrollAuth } from "@/lib/payroll/server";

// { action: "approve" | "reject" | "cancel", note? }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = ((await request.json().catch(() => null)) ?? {}) as { action?: unknown; note?: unknown };
  const r = await decideLeave(auth.companyId, auth.userId, params.id, body.action, body.note);
  return NextResponse.json(r.error ? { error: r.error } : { leave: r.record }, { status: r.status });
}
