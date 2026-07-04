import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePoster } from "@/lib/currentUser";

// Deletes an importation. Scoped to the caller's company; requires the same
// posting capability used to create one.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.importation.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const auth = await resolvePoster(existing.companyId, "canPost");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await prisma.importation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
