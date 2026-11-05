import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLoginTicket } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { finishLogin, loginBlocker } from "@/lib/loginFinish";
import { describeLoginHours, isWithinLoginHours } from "@/lib/loginHours";

// Step 1 of sign-in: email + password. If the user has two-factor turned on,
// or their company's allowed login hours are set and it's outside them, the
// response is { needCode, ticket } and the client finishes at
// /api/auth/login/verify with the authenticator code.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Deliberately identical error for "no such user" and "wrong
  // password" — distinguishing them lets an attacker enumerate which
  // emails are registered.
  const invalid = () => NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  if (!user) return invalid();
  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return invalid();

  const blocked = await loginBlocker(user);
  if (blocked) return blocked;

  // Company allowed login hours (subscribers only; admins have no company).
  let outsideHours = false;
  let hoursText = "";
  if (user.role === "USER" && user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { loginHoursEnabled: true, loginStart: true, loginEnd: true, loginDays: true },
    });
    if (company && !isWithinLoginHours(company)) {
      outsideHours = true;
      hoursText = describeLoginHours(company);
    }
  }

  if (user.totpEnabled && user.totpSecret) {
    // A correct password resets the wrong-code counter: the lock is per
    // password entry, so a guesser has to know the password every 5 tries.
    if (user.totpFailedCount > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { totpFailedCount: 0 } });
    }
    return NextResponse.json({
      needCode: true,
      ticket: await createLoginTicket(user.id),
      reason: outsideHours
        ? `You're signing in outside your company's allowed hours (${hoursText}).`
        : null,
    });
  }

  if (outsideHours) {
    return NextResponse.json(
      {
        error:
          `Your company allows sign-in only ${hoursText}. Outside those hours you need two-factor authentication, ` +
          `which isn't set up on your account yet. Turn it on from My Profile during allowed hours, or ask your administrator.`,
      },
      { status: 403 }
    );
  }

  return finishLogin(user, request, { twoFactor: false });
}
