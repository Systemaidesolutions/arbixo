import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { getCurrentPrice } from "@/lib/subscriptionPricing";
import { voucherDiscount, voucherStatus } from "@/lib/vouchers";

// Previews a voucher against the current price. Does NOT redeem it — that
// happens when the payment is submitted.
export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  if (!capabilitiesFor(user.role, user.subscriberSubtype).canApprove) {
    return NextResponse.json({ error: "Only a Manager can renew the subscription." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ error: "Enter a voucher code." }, { status: 400 });

  const [voucher, price] = await Promise.all([
    prisma.voucher.findUnique({ where: { code } }),
    getCurrentPrice(),
  ]);
  if (!price) return NextResponse.json({ error: "No subscription price is set. Contact your administrator." }, { status: 400 });
  if (!voucher || voucherStatus(voucher) !== "active") {
    return NextResponse.json({ valid: false, error: "That voucher isn't valid or has already been used." }, { status: 200 });
  }

  const base = Number(price.amount);
  const discount = voucherDiscount(voucher, base);
  return NextResponse.json({
    valid: true,
    code: voucher.code,
    discountType: voucher.discountType,
    discountValue: Number(voucher.discountValue),
    discountAmount: discount,
    finalAmount: Math.round((base - discount) * 100) / 100,
  });
}
