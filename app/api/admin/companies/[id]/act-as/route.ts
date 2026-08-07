import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { ACTING_AS_COOKIE } from "@/lib/adminActingAs";

// Admin starts "acting as" one company — full Manager-level access to its
// books, for support/troubleshooting. See lib/adminActingAs.ts and
// lib/currentUser.ts (getCurrentCompany/resolvePoster/requirePostingCompany).
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTING_AS_COOKIE, company.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Short-lived on purpose — an admin session left "acting as" a company
    // shouldn't linger for the full 7-day login window.
    maxAge: 60 * 60 * 4,
  });
  return response;
}
