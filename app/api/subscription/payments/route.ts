import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, getCurrentCapability, effectiveCompanyId } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";

// Subscription payment log. A platform admin (not currently acting inside a
// company) sees every company's payments; a Manager — or an admin acting
// inside a company (lib/adminActingAs.ts) — sees only that one company's.
export async function GET() {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isPlatformAdmin = user.role === "ADMIN" && !getAdminActingAsCompanyId();
  const companyId = await effectiveCompanyId();
  const cap = await getCurrentCapability();
  const isManager = !!companyId && !!cap?.canApprove;
  if (!isPlatformAdmin && !isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payments = await prisma.subscriptionPayment.findMany({
    where: isPlatformAdmin ? {} : { companyId: companyId ?? "" },
    include: { company: { select: { tradeName: true, registeredName: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ isAdmin: isPlatformAdmin, payments });
}
