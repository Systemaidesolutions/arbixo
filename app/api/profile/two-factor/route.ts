import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { verifyPassword } from "@/lib/password";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";

// Self-service two-factor (authenticator app) for the signed-in user.
//   POST { action: "start" }               -> new pending secret + otpauth URI
//   POST { action: "confirm", code }        -> turns 2FA on if the code matches
//   DELETE { password, code }               -> turns 2FA off
export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  if (body?.action === "start") {
    if (user.totpEnabled) return NextResponse.json({ error: "Two-factor is already on." }, { status: 400 });
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpPendingSecret: secret } });
    return NextResponse.json({ secret, uri: totpUri(secret, user.email) });
  }

  if (body?.action === "confirm") {
    if (!user.totpPendingSecret) {
      return NextResponse.json({ error: "Start the setup again." }, { status: 400 });
    }
    const step = verifyTotp(user.totpPendingSecret, String(body.code ?? ""));
    if (step === null) {
      return NextResponse.json(
        { error: "That code didn't match. Check your phone's clock is set automatically, and try the newest code." },
        { status: 400 }
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        totpLastStep: step,
        totpFailedCount: 0,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.totpEnabled || !user.totpSecret) return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => ({}));
  const passwordOk = await verifyPassword(String(body?.password ?? ""), user.passwordHash);
  if (!passwordOk) return NextResponse.json({ error: "Your password is incorrect." }, { status: 400 });
  if (verifyTotp(user.totpSecret, String(body?.code ?? "")) === null) {
    return NextResponse.json({ error: "That code didn't match." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, totpPendingSecret: null, totpLastStep: null, totpFailedCount: 0 },
  });
  return NextResponse.json({ ok: true });
}
