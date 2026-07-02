import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/resetToken";
import { sendPasswordResetEmail } from "@/lib/mail";

// Admin triggers a password reset for a user: mint a single-use token,
// store its hash, and email the link. Returns the link directly ONLY when
// email delivery isn't configured yet, so the admin can still relay it.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { raw, hash } = generateResetToken();
  await prisma.user.update({
    where: { id: target.id },
    data: { resetTokenHash: hash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/reset-password?uid=${target.id}&token=${raw}`;

  const { sent } = await sendPasswordResetEmail(target.email, resetUrl);

  return NextResponse.json({
    ok: true,
    emailed: sent,
    // Only surfaced when we couldn't email it — lets the admin copy the
    // link for now. Once RESEND_API_KEY is set, this is omitted.
    resetUrl: sent ? undefined : resetUrl,
  });
}
