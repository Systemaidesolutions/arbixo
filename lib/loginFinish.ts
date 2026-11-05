import { NextRequest, NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { isNightLoginPH, formatPH } from "@/lib/loginAlert";
import { sendNightLoginAlert } from "@/lib/mail";

/**
 * Checks that stop a sign-in even with the right password (disabled,
 * unverified, company switched off). Run at the password step AND again at
 * the 2FA step, since the account could change in between. Returns an error
 * response, or null when the user may continue.
 */
export async function loginBlocker(user: User): Promise<NextResponse | null> {
  if (user.isDisabled) {
    return NextResponse.json(
      { error: "This account has been disabled. Contact your administrator." },
      { status: 403 }
    );
  }
  if (!user.isVerified) {
    return NextResponse.json(
      { error: "This account hasn't been verified yet. Check your email for the code, or register again to get a new one." },
      { status: 403 }
    );
  }
  // Company-level disable blocks all its users, regardless of subtype. A
  // lapsed subscription does NOT reach here — only an admin toggling the
  // company off does.
  if (user.role === "USER" && user.companyId) {
    const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { isActive: true } });
    if (company && !company.isActive) {
      return NextResponse.json(
        { error: "This company account has been disabled. Please contact your administrator." },
        { status: 403 }
      );
    }
  }
  return null;
}

/** Final step of any successful sign-in: audit, night alert, session cookie. */
export async function finishLogin(user: User, request: NextRequest, opts: { twoFactor: boolean }): Promise<NextResponse> {
  // Audit the login against the user's company (subscribers only — admins
  // aren't scoped to a company).
  if (user.companyId) {
    await logAudit({
      companyId: user.companyId,
      username: user.email,
      action: opts.twoFactor ? "Logged in (two-factor)" : "Logged in",
      ipAddress: getClientIp(request),
    });
  }

  // Security: a sign-in between 8 PM and 4 AM Philippine time emails every
  // admin. Best-effort — a failed alert never blocks the login.
  const now = new Date();
  if (isNightLoginPH(now)) {
    try {
      const [admins, company] = await Promise.all([
        prisma.user.findMany({ where: { role: "ADMIN", isDisabled: false }, select: { email: true } }),
        user.companyId
          ? prisma.company.findUnique({ where: { id: user.companyId }, select: { tradeName: true } })
          : null,
      ]);
      await sendNightLoginAlert(
        admins.map((a) => a.email),
        {
          email: user.email,
          role: user.role,
          companyName: company?.tradeName ?? null,
          when: formatPH(now) + (opts.twoFactor ? " (verified with two-factor)" : ""),
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
        }
      );
    } catch (err) {
      console.error("[login] night-time alert failed", err);
    }
  }

  const token = await createSessionToken({ sub: user.id, email: user.email, role: user.role });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
