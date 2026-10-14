import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

// Lightweight id/name list for admin pickers (e.g. "which company is ARbixo
// itself" in Subscription > Business profile) — not the full Companies page.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const companies = await prisma.company.findMany({
    select: { id: true, tradeName: true, registeredName: true },
    orderBy: { tradeName: "asc" },
  });
  return NextResponse.json({ companies });
}
