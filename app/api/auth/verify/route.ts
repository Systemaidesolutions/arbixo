import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const code = body?.code?.trim();

  if (!email || !code) {
    return NextResponse.json({ error: "email and code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.verificationCode) {
    return NextResponse.json({ error: "No pending verification for this email" }, { status: 404 });
  }
  if (user.isVerified) {
    return NextResponse.json({ error: "This email is already verified. Log in instead." }, { status: 409 });
  }
  if (!user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "This code has expired. Register again to get a new one." },
      { status: 400 }
    );
  }
  if (user.verificationCode !== code) {
    return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verificationCode: null, verificationExpiresAt: null },
  });

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
