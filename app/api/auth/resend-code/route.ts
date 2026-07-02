import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerificationCode } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Re-issues a verification code for an account that registered but never
 * verified. Previously the only way to get a fresh code was to re-run
 * the whole registration form; if the first email never arrived the user
 * was stuck. This gives the verify page a "Resend code" action.
 *
 * Responds the same way whether or not the email exists, so it can't be
 * used to enumerate which addresses are registered.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Don't reveal whether the account exists or is already verified.
  if (!user || user.isVerified) {
    return NextResponse.json({ ok: true, emailDelivered: true });
  }

  const verificationCode = generateVerificationCode();
  const verificationExpiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode, verificationExpiresAt },
  });

  try {
    const { delivered } = await sendVerificationEmail(email, verificationCode);
    return NextResponse.json({ ok: true, emailDelivered: delivered });
  } catch (err) {
    console.error("[resend-code] verification email failed to send:", err);
    return NextResponse.json(
      {
        error:
          "We couldn't send the verification email. The email service may be misconfigured — contact support if this continues.",
      },
      { status: 502 }
    );
  }
}
