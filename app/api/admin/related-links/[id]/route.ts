import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { normalizeUrl, validateLogo } from "@/lib/relatedLinks";

// Update a related link (admin only). Any subset of name/url/logoUrl.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const data: { name?: string; url?: string; logoUrl?: string | null } = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    data.name = name.slice(0, 120);
  }
  if ("url" in body) {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "Link can't be empty." }, { status: 400 });
    data.url = normalizeUrl(url);
  }
  if ("logoUrl" in body) {
    const logoError = validateLogo(body.logoUrl);
    if (logoError) return NextResponse.json({ error: logoError }, { status: 400 });
    data.logoUrl = body.logoUrl || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.relatedLink.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}

// Delete a related link (admin only).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  await prisma.relatedLink.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
