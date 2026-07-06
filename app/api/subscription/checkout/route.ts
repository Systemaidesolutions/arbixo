import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { getCurrentPrice } from "@/lib/subscriptionPricing";

// Data the renew flow needs: current price, the GCash account, and the
// company's current subscription end. Manager-only.
export async function GET() {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  if (!capabilitiesFor(user.role, user.subscriberSubtype).canApprove) {
    return NextResponse.json({ error: "Only a Manager can renew the subscription." }, { status: 403 });
  }

  const [price, settings, company] = await Promise.all([
    getCurrentPrice(),
    prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { gcashName: true, gcashNumber: true } }),
    prisma.company.findUnique({ where: { id: user.companyId }, select: { subscriptionEndsAt: true } }),
  ]);

  return NextResponse.json({
    price: price
      ? { name: price.name, amount: Number(price.amount), currency: price.currency }
      : null,
    gcash: { name: settings?.gcashName ?? "", number: settings?.gcashNumber ?? "" },
    subscriptionEndsAt: company?.subscriptionEndsAt ?? null,
  });
}
