import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { cleanDenied } from "@/lib/userPermissions";

// Admin › User access: set which access groups are REMOVED from a
// subscriber (lib/userPermissions.ts), and whether two-factor is required.
// Body: { denied?: PermissionKey[]; require2fa?: boolean } — an empty
// denied list restores full access.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { denied?: unknown; require2fa?: unknown } | null;
  const hasDenied = Array.isArray(body?.denied);
  const hasRequire = typeof body?.require2fa === "boolean";
  if (!body || (!hasDenied && !hasRequire)) {
    return NextResponse.json({ error: "denied or require2fa is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "ADMIN") return NextResponse.json({ error: "Admins always have full access." }, { status: 400 });

  const saved = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(hasDenied ? { deniedPermissions: cleanDenied(body.denied) } : {}),
      ...(hasRequire ? { require2fa: body.require2fa as boolean } : {}),
    },
    select: { deniedPermissions: true, require2fa: true },
  });
  return NextResponse.json({ denied: cleanDenied(saved.deniedPermissions), require2fa: saved.require2fa });
}
