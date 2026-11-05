import { NextRequest, NextResponse } from "next/server";
import { payrollAuth } from "@/lib/payroll/server";
import { decideReimbursement } from "@/lib/payroll/reimbursementServer";

// Payroll staff: { action: "approve" | "reject" | "paid" | "cancel", note? }.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const r = await decideReimbursement(auth.companyId, auth.userId, params.id, body?.action, body?.note);
  return NextResponse.json(r.error ? { error: r.error } : { ok: true }, { status: r.status });
}
