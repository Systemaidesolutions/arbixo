import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLoginTicket } from "@/lib/auth";
import { finishLogin, loginBlocker } from "@/lib/loginFinish";
import { TOTP_MAX_FAILED, verifyTotp } from "@/lib/totp";

// Step 2 of sign-in: exchange the ticket from step 1 plus an authenticator
// code for a session. After TOTP_MAX_FAILED wrong codes the ticket is dead
// and the user must enter their password again.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ticket = typeof body?.ticket === "string" ? body.ticket : "";
  const code = typeof body?.code === "string" ? body.code : "";

  const restart = (error: string) => NextResponse.json({ error, restart: true }, { status: 401 });

  const userId = ticket ? await verifyLoginTicket(ticket) : null;
  if (!userId) return restart("Your sign-in timed out. Enter your email and password again.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpEnabled || !user.totpSecret) return restart("Enter your email and password again.");

  const blocked = await loginBlocker(user);
  if (blocked) return blocked;

  if (user.totpFailedCount >= TOTP_MAX_FAILED) {
    return restart("Too many wrong codes. Enter your email and password again.");
  }

  const step = verifyTotp(user.totpSecret, code, { lastStep: user.totpLastStep });
  if (step === null) {
    const failed = user.totpFailedCount + 1;
    await prisma.user.update({ where: { id: user.id }, data: { totpFailedCount: failed } });
    if (failed >= TOTP_MAX_FAILED) return restart("Too many wrong codes. Enter your email and password again.");
    return NextResponse.json(
      { error: `That code didn't match. ${TOTP_MAX_FAILED - failed} tr${TOTP_MAX_FAILED - failed === 1 ? "y" : "ies"} left.` },
      { status: 401 }
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: step, totpFailedCount: 0 } });
  return finishLogin(user, request, { twoFactor: true });
}
