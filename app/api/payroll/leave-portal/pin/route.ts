import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payrollAuth } from "@/lib/payroll/server";
import { hashPassword } from "@/lib/password";
import { generatePin, isValidPin } from "@/lib/leavePortalRules";

// Payroll staff set, reset or remove an employee's leave-portal PIN. Only
// staff can do this; employees can't change their own PIN.
// Body: { employeeId, pin?: "1234" | generate?: true | remove?: true }.
// A generated PIN is returned once so staff can pass it to the employee.
export async function POST(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId: auth.companyId }, select: { id: true } });
  if (!emp) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  if (body?.remove === true) {
    await prisma.employee.update({
      where: { id: emp.id },
      data: { portalPinHash: null, portalPinSetAt: null, portalFailedCount: 0, portalLockedUntil: null },
    });
    return NextResponse.json({ ok: true });
  }

  const pin = body?.generate === true ? generatePin() : body?.pin;
  if (!isValidPin(pin)) return NextResponse.json({ error: "The PIN must be 4 to 6 digits." }, { status: 400 });

  // A new portalPinSetAt also signs the employee out of any open portal session.
  await prisma.employee.update({
    where: { id: emp.id },
    data: { portalPinHash: await hashPassword(pin), portalPinSetAt: new Date(), portalFailedCount: 0, portalLockedUntil: null },
  });
  return NextResponse.json({ ok: true, pin: body?.generate === true ? pin : undefined });
}
