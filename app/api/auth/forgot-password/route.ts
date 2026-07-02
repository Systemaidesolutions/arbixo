import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/resetToken";
import { sendPasswordResetEmail } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Self-service "forgot password". Always responds the same way so it can't
// be used to probe which emails are registered.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.isDisabled) {
    const { raw, hash } = generateResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: hash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });
    const origin = new URL(request.url).origin;
    await sendPasswordResetEmail(user.email, `${origin}/reset-password?uid=${user.id}&token=${raw}`);
  }

  return NextResponse.json({ ok: true });
}
