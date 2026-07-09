import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createItem, posterCompanyId, type ItemInput } from "@/lib/items";

export async function GET(request: NextRequest) {
  const companyId = await posterCompanyId();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const activeOnly = request.nextUrl.searchParams.get("activeOnly") !== "false";
  const items = await prisma.item.findMany({
    where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const companyId = await posterCompanyId();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as ItemInput;
  const r = await createItem(companyId, raw);
  return NextResponse.json(r.error ? { error: r.error } : { item: r.item }, { status: r.status });
}
