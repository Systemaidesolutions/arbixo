import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payrollAuth } from "@/lib/payroll/server";
import { parseCashAdvance } from "@/lib/payroll/cashAdvanceServer";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Payroll › Cash advances: record a cash advance given to an employee.
export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const input = parseCashAdvance(raw);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
  const emp = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId: auth.companyId }, select: { id: true } });
  if (!emp) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  const rec = await prisma.cashAdvance.create({
    data: {
      companyId: auth.companyId, employeeId: input.employeeId, date: day(input.date), amount: input.amount, installment: input.installment,
      startDate: input.startDate ? day(input.startDate) : null, reference: input.reference, description: input.description, createdById: auth.userId,
    },
  });
  return NextResponse.json({ id: rec.id }, { status: 201 });
}
