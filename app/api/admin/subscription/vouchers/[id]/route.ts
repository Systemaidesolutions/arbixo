import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

// Toggle a voucher active/inactive (can't reactivate a redeemed one).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const isActive = Boolean(body?.isActive);

  const voucher = await prisma.voucher.findUnique({ where: { id: params.id } });
  if (!voucher) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (voucher.redeemedAt) {
    return NextResponse.json({ error: "A redeemed voucher can't be changed." }, { status: 400 });
  }

  const updated = await prisma.voucher.update({ where: { id: params.id }, data: { isActive } });
  return NextResponse.json({ voucher: updated });
}
