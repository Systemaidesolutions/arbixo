import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerificationCode } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.isVerified) {
    return NextResponse.json(
      { error: "This email is already registered. Try logging in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const verificationCode = generateVerificationCode();
  const verificationExpiresAt = new Date(Date.now() + CODE_TTL_MS);

  // If they started registering before but never verified, this
  // overwrites the password and issues a fresh code rather than
  // erroring — someone who mistyped their password or lost the first
  // code shouldn't get stuck.
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, verificationCode, verificationExpiresAt },
    update: { passwordHash, verificationCode, verificationExpiresAt },
  });

  const { sent } = await sendVerificationEmail(email, verificationCode);

  return NextResponse.json({ ok: true, email, emailSent: sent });
}
