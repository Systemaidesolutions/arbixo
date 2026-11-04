import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveCompanyId } from "@/lib/currentUser";
import { priceForRequest } from "@/lib/subscriptionPricing";
import { voucherDiscount, voucherStatus } from "@/lib/vouchers";

// Previews a voucher against the current price. Does NOT redeem it — that
// happens when the payment is submitted.
export async function POST(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  // Any user of the company may renew; an admin verifies the payment
  // (payments an admin records while acting in the company count at once).

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ error: "Enter a voucher code." }, { status: 400 });

  const [voucher, priced] = await Promise.all([
    prisma.voucher.findUnique({ where: { code } }),
    priceForRequest(body),
  ]);
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: 400 });
  const price = priced.price;
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
