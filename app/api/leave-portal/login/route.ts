import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createPortalToken, PORTAL_COOKIE, portalCookieOptions } from "@/lib/leavePortal";
import { PORTAL_LOCK_MINUTES, afterWrongPin, isLocked } from "@/lib/leavePortalRules";

// Employee leave portal sign-in: company portal code (from the link) +
// employee code + PIN. Wrong PINs lock the employee for a while; only payroll
// staff can set or reset a PIN.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const portal = typeof body?.portal === "string" ? body.portal.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (!portal || !code || !pin) return NextResponse.json({ error: "Enter your employee number and PIN." }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { leavePortalCode: portal }, select: { id: true, leavePortalEnabled: true } });
  if (!company || !company.leavePortalEnabled) {
    return NextResponse.json({ error: "This leave link isn't active. Ask your HR or payroll staff." }, { status: 404 });
  }

  // Employee codes are matched case-insensitively.
  const emp = await prisma.employee.findFirst({
    where: { companyId: company.id, code: { equals: code, mode: "insensitive" }, isActive: true },
  });
  const invalid = () => NextResponse.json({ error: "Incorrect employee number or PIN." }, { status: 401 });
  if (!emp || !emp.portalPinHash || !emp.portalPinSetAt) return invalid();

  if (isLocked(emp.portalLockedUntil)) {
    return NextResponse.json(
      { error: `Too many wrong PINs. Try again in ${PORTAL_LOCK_MINUTES} minutes, or ask your HR or payroll staff to reset your PIN.` },
      { status: 429 }
    );
  }

  if (!(await verifyPassword(pin, emp.portalPinHash))) {
    const next = afterWrongPin(emp.portalFailedCount);
    await prisma.employee.update({ where: { id: emp.id }, data: { portalFailedCount: next.failed, portalLockedUntil: next.lockedUntil } });
    if (next.lockedUntil) {
      return NextResponse.json(
        { error: `Too many wrong PINs. Try again in ${PORTAL_LOCK_MINUTES} minutes, or ask your HR or payroll staff to reset your PIN.` },
        { status: 429 }
      );
    }
    return invalid();
  }

  if (emp.portalFailedCount || emp.portalLockedUntil) {
    await prisma.employee.update({ where: { id: emp.id }, data: { portalFailedCount: 0, portalLockedUntil: null } });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_COOKIE, await createPortalToken(emp.id, company.id, emp.portalPinSetAt), portalCookieOptions);
  return res;
}
