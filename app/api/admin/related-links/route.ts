import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { normalizeUrl, validateLogo } from "@/lib/relatedLinks";

// Create a related link (admin only).
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

  if (!name || !rawUrl) {
    return NextResponse.json({ error: "Name and link are required." }, { status: 400 });
  }
  const logoError = validateLogo(body?.logoUrl);
  if (logoError) {
    return NextResponse.json({ error: logoError }, { status: 400 });
  }

  const last = await prisma.relatedLink.findFirst({ orderBy: { sortOrder: "desc" } });
  const link = await prisma.relatedLink.create({
    data: {
      name: name.slice(0, 120),
      url: normalizeUrl(rawUrl),
      logoUrl: body?.logoUrl || null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ ok: true, id: link.id });
}
