import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalEmployee } from "@/lib/leavePortal";

// Employee withdraws one of their own leave filings while it's still PENDING.
// Approved leave can only be cancelled by payroll staff.
export async function POST(request: NextRequest) {
  const emp = await getPortalEmployee();
  if (!emp) return NextResponse.json({ error: "Please sign in again.", signin: true }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";

  const req = await prisma.leaveRequest.findFirst({ where: { id, companyId: emp.companyId, employeeId: emp.id, kind: "FILING" } });
  if (!req) return NextResponse.json({ error: "Leave filing not found." }, { status: 404 });
  if (req.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending filings can be withdrawn. Ask your HR or payroll staff." }, { status: 400 });
  }
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED", decidedAt: new Date(), decisionNote: "Withdrawn by the employee" },
  });
  return NextResponse.json({ ok: true });
}
