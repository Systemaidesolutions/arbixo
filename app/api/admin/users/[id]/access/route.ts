import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { cleanDenied } from "@/lib/userPermissions";

// Admin › User access: set which access groups are REMOVED from a
// subscriber (lib/userPermissions.ts). Body: { denied: PermissionKey[] };
// an empty list restores full access.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { denied?: unknown } | null;
  if (!body || !Array.isArray(body.denied)) return NextResponse.json({ error: "denied is required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "ADMIN") return NextResponse.json({ error: "Admins always have full access." }, { status: 400 });

  const denied = cleanDenied(body.denied);
  await prisma.user.update({ where: { id: params.id }, data: { deniedPermissions: denied } });
  return NextResponse.json({ denied });
}
