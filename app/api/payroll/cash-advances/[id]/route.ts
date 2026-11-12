import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payrollAuth } from "@/lib/payroll/server";
import { deductedByAdvance, parseCashAdvance } from "@/lib/payroll/cashAdvanceServer";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function load(companyId: string, id: string) {
  const rec = await prisma.cashAdvance.findFirst({ where: { id, companyId } });
  if (!rec) return null;
  const d = (await deductedByAdvance(companyId, [id])).get(id) ?? { posted: 0, draft: 0 };
  return { rec, ...d };
}

// Edit a cash advance. The employee can't change once anything was deducted,
// and the amount can't go below what posted payroll runs already deducted.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const cur = await load(auth.companyId, params.id);
  if (!cur) return NextResponse.json({ error: "Cash advance not found." }, { status: 404 });
  if (cur.rec.status === "CANCELLED") return NextResponse.json({ error: "Reactivate this cash advance before editing it." }, { status: 400 });
  const input = parseCashAdvance(((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
  if (input.employeeId !== cur.rec.employeeId && cur.posted + cur.draft > 0) {
    return NextResponse.json({ error: "Installments were already deducted, so the employee can't be changed." }, { status: 400 });
  }
  if (input.amount < cur.posted - 0.005) {
    return NextResponse.json({ error: `Posted payroll runs already deducted ${cur.posted.toFixed(2)}; the amount can't be less than that.` }, { status: 400 });
  }
  const emp = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId: auth.companyId }, select: { id: true } });
  if (!emp) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  const status = cur.posted >= input.amount - 0.005 ? "PAID" : "ACTIVE";
  await prisma.cashAdvance.update({
    where: { id: cur.rec.id },
    data: {
      employeeId: input.employeeId, date: day(input.date), amount: input.amount, installment: input.installment,
      startDate: input.startDate ? day(input.startDate) : null, reference: input.reference, description: input.description, status,
    },
  });
  return NextResponse.json({ ok: true });
}

// { action: "cancel", note } stops deducting (posted deductions stay);
// { action: "reactivate" } resumes; { action: "delete" } only when nothing was posted.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const cur = await load(auth.companyId, params.id);
  if (!cur) return NextResponse.json({ error: "Cash advance not found." }, { status: 404 });
  const body = ((await request.json().catch(() => null)) ?? {}) as { action?: string; note?: string };
  const draftRuns = { companyId: auth.companyId, cashAdvanceId: cur.rec.id, payrollRun: { status: "DRAFT" as const } };

  if (body.action === "cancel") {
    if (cur.rec.status !== "ACTIVE") return NextResponse.json({ error: "Only active cash advances can be cancelled." }, { status: 400 });
    await prisma.cashAdvanceDeduction.deleteMany({ where: draftRuns });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;
    await prisma.cashAdvance.update({ where: { id: cur.rec.id }, data: { status: "CANCELLED", note } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "reactivate") {
    if (cur.rec.status !== "CANCELLED") return NextResponse.json({ error: "Only cancelled cash advances can be reactivated." }, { status: 400 });
    await prisma.cashAdvance.update({ where: { id: cur.rec.id }, data: { status: cur.posted >= Number(cur.rec.amount) - 0.005 ? "PAID" : "ACTIVE", note: null } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete") {
    if (cur.posted > 0) return NextResponse.json({ error: "Posted payroll runs already deducted from this cash advance. Cancel it instead." }, { status: 400 });
    await prisma.cashAdvance.delete({ where: { id: cur.rec.id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
