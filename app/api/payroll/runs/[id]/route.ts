import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payrollAuth, saveRunInputs } from "@/lib/payroll/server";
import { payrollSubscriptionProblem } from "@/lib/payroll/subscription";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.isAdmin) {
    const run = await prisma.payrollRun.findFirst({ where: { id: params.id, companyId: auth.companyId } });
    const problem = run && run.status === "DRAFT" ? await payrollSubscriptionProblem(auth.companyId, run) : null;
    if (problem) return NextResponse.json({ error: problem }, { status: 402 });
  }
  const r = await saveRunInputs(auth.companyId, params.id, (await request.json().catch(() => null)) ?? {});
  return NextResponse.json(r.error ? { error: r.error } : { ok: true }, { status: r.status });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const run = await prisma.payrollRun.findFirst({ where: { id: params.id, companyId: auth.companyId } });
  if (!run) return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });
  if (run.status !== "DRAFT") return NextResponse.json({ error: "Only draft runs can be deleted. Cancel a posted run instead." }, { status: 400 });
  await prisma.payrollRun.delete({ where: { id: run.id } });
  return NextResponse.json({ ok: true });
}
