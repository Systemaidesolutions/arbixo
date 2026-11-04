import { NextRequest, NextResponse } from "next/server";
import { UnbalancedEntryError, DuplicateDocumentError } from "@/lib/ledgerPosting";
import { prisma } from "@/lib/prisma";
import { payrollAuth, postRun } from "@/lib/payroll/server";
import { payrollSubscriptionProblem } from "@/lib/payroll/subscription";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.isAdmin) {
    const run = await prisma.payrollRun.findFirst({ where: { id: params.id, companyId: auth.companyId } });
    const problem = run && run.status === "DRAFT" ? await payrollSubscriptionProblem(auth.companyId, run) : null;
    if (problem) return NextResponse.json({ error: problem }, { status: 402 });
  }
  try {
    const r = await postRun(auth.companyId, auth.userId, params.id);
    return NextResponse.json(r.error ? { error: r.error } : { ok: true }, { status: r.status });
  } catch (e) {
    if (e instanceof UnbalancedEntryError || e instanceof DuplicateDocumentError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
