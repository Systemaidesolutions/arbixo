import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Employee leave portal sessions. Employees have no ARbixo user account: they
// sign in at /leave/<company code> with their employee code + a PIN set by
// payroll staff. The session is its own signed cookie, never accepted as an
// app session (lib/auth.ts rejects tokens with a `purpose`).

export const PORTAL_COOKIE = "arbixo_leave";
const PURPOSE = "leave-portal";
const PORTAL_HOURS = 12;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createPortalToken(employeeId: string, companyId: string, pinSetAt: Date): Promise<string> {
  return new SignJWT({ purpose: PURPOSE, cid: companyId, pin: pinSetAt.getTime() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(employeeId)
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_HOURS}h`)
    .sign(secret());
}

export const portalCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: PORTAL_HOURS * 60 * 60,
};

/**
 * The signed-in portal employee, or null. Checks that the company's portal is
 * still on, the employee is still active, and the PIN hasn't been reset since
 * this session started.
 */
export async function getPortalEmployee() {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  let sub: string, cid: string, pin: number;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== PURPOSE || typeof payload.sub !== "string" || typeof payload.cid !== "string" || typeof payload.pin !== "number") return null;
    sub = payload.sub;
    cid = payload.cid;
    pin = payload.pin;
  } catch {
    return null;
  }
  const emp = await prisma.employee.findFirst({
    where: { id: sub, companyId: cid, isActive: true },
    include: { company: { select: { id: true, tradeName: true, leavePortalEnabled: true, leavePortalCode: true } } },
  });
  if (!emp || !emp.company.leavePortalEnabled || !emp.portalPinHash || emp.portalPinSetAt?.getTime() !== pin) return null;
  return emp;
}
