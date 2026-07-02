import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/resetToken";
import { hashPassword } from "@/lib/password";

// Public: a user completes their reset by submitting the token from the
// emailed link plus a new password.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { uid?: string; token?: string; password?: string }
    | null;
  const uid = body?.uid;
  const token = body?.token;
  const password = body?.password;

  if (!uid || !token) {
    return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
    return NextResponse.json(
      { error: "This reset link is invalid or has already been used." },
      { status: 400 }
    );
  }
  if (user.resetTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link has expired. Ask your administrator for a new one." },
      { status: 400 }
    );
  }
  if (hashResetToken(token) !== user.resetTokenHash) {
    return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // Completing a reset proves control of the account, so clear the
      // token and mark verified — they can log in immediately.
      isVerified: true,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
