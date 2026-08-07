import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { getCurrentPrice } from "@/lib/subscriptionPricing";

// Data the renew flow needs: current price, the GCash account, and the
// company's current subscription end. Manager-only (or an admin acting
// inside the company — see lib/adminActingAs.ts).
export async function GET() {
  const companyId = await effectiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) {
    return NextResponse.json({ error: "Only a Manager can renew the subscription." }, { status: 403 });
  }

  const [price, settings, company] = await Promise.all([
    getCurrentPrice(),
    prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { gcashName: true, gcashNumber: true, gcashQrImage: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { subscriptionEndsAt: true } }),
  ]);

  return NextResponse.json({
    price: price
      ? { name: price.name, amount: Number(price.amount), currency: price.currency }
      : null,
    gcash: { name: settings?.gcashName ?? "", number: settings?.gcashNumber ?? "", qrImage: settings?.gcashQrImage ?? null },
    subscriptionEndsAt: company?.subscriptionEndsAt ?? null,
  });
}
