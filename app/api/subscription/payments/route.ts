import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";

// Subscription payment log. Admins see every company's payments; a Manager sees
// only their own company's.
export async function GET() {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isAdmin = user.role === "ADMIN";
  const isManager = user.role === "USER" && capabilitiesFor(user.role, user.subscriberSubtype).canApprove;
  if (!isAdmin && !isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payments = await prisma.subscriptionPayment.findMany({
    where: isAdmin ? {} : { companyId: user.companyId ?? "" },
    include: { company: { select: { tradeName: true, registeredName: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ isAdmin, payments });
}
