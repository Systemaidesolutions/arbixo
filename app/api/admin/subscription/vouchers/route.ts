import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { createVouchers } from "@/lib/vouchers";
import type { VoucherDiscountType } from "@prisma/client";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ vouchers });
}

// Generates one voucher, or a batch (count > 1).
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const count = Number(body?.count) || 1;
  const discountType = (body?.discountType === "PERCENT" ? "PERCENT" : "FIXED") as VoucherDiscountType;
  const discountValue = Number(body?.discountValue);
  const note = typeof body?.note === "string" ? body.note : null;

  if (!(discountValue > 0)) {
    return NextResponse.json({ error: "Discount value must be greater than zero." }, { status: 400 });
  }
  if (discountType === "PERCENT" && discountValue > 100) {
    return NextResponse.json({ error: "Percentage discount can't exceed 100%." }, { status: 400 });
  }

  const { batchId, codes } = await createVouchers({ count, discountType, discountValue, note });
  return NextResponse.json({ batchId, codes, count: codes.length }, { status: 201 });
}
