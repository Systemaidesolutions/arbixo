import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

// Admin turns off a user's two-factor (e.g. lost phone). The user can set it
// up again from My Profile.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: target.id },
    data: { totpEnabled: false, totpSecret: null, totpPendingSecret: null, totpLastStep: null, totpFailedCount: 0 },
  });
  return NextResponse.json({ ok: true });
}
