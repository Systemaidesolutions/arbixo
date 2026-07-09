import { NextRequest, NextResponse } from "next/server";
import { updateItem, posterCompanyId, type ItemInput } from "@/lib/items";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const companyId = await posterCompanyId();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = ((await request.json().catch(() => null)) ?? {}) as ItemInput;
  const r = await updateItem(companyId, { ...raw, itemId: params.id });
  return NextResponse.json(r.error ? { error: r.error } : { item: r.item }, { status: r.status });
}
