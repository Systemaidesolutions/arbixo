import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

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
