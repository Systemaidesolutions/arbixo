import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalEmployee } from "@/lib/leavePortal";

// Employee withdraws one of their own reimbursements while it's still PENDING.
export async function POST(request: NextRequest) {
  const emp = await getPortalEmployee();
  if (!emp) return NextResponse.json({ error: "Please sign in again.", signin: true }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const rec = await prisma.reimbursement.findFirst({ where: { id, companyId: emp.companyId, employeeId: emp.id }, select: { status: true } });
  if (!rec) return NextResponse.json({ error: "Reimbursement not found." }, { status: 404 });
  if (rec.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending reimbursements can be withdrawn. Ask your HR or payroll staff." }, { status: 400 });
  }
  await prisma.reimbursement.update({ where: { id }, data: { status: "CANCELLED", decidedAt: new Date(), decisionNote: "Withdrawn by the employee" } });
  return NextResponse.json({ ok: true });
}
