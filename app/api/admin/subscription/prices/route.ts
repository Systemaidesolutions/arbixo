import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { listPrices, addPrice } from "@/lib/subscriptionPricing";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const prices = await listPrices();
  return NextResponse.json({ prices });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const amount = Number(body?.amount);
  const currency = typeof body?.currency === "string" ? body.currency.trim() : "PHP";
  const effectiveFrom = body?.effectiveFrom ? new Date(`${body.effectiveFrom}T00:00:00`) : null;

  if (!name) return NextResponse.json({ error: "Price name is required." }, { status: 400 });
  if (!(amount >= 0)) return NextResponse.json({ error: "Amount must be a non-negative number." }, { status: 400 });
  if (!effectiveFrom || isNaN(effectiveFrom.getTime())) {
    return NextResponse.json({ error: "A valid effective-from date is required." }, { status: 400 });
  }

  const price = await addPrice({ name, amount, currency, effectiveFrom });
  return NextResponse.json({ price }, { status: 201 });
}
