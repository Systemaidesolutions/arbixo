import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

const MAX_IMG = 2 * 1024 * 1024; // ~1.5 MB image after base64 overhead

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
    select: { gcashName: true, gcashNumber: true, gcashQrImage: true },
  });
  return NextResponse.json({
    gcashName: settings?.gcashName ?? "",
    gcashNumber: settings?.gcashNumber ?? "",
    gcashQrImage: settings?.gcashQrImage ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const gcashName = typeof body?.gcashName === "string" ? body.gcashName.trim() : "";
  const gcashNumber = typeof body?.gcashNumber === "string" ? body.gcashNumber.replace(/[^\d]/g, "") : "";
  // gcashQrImage: string data URL to set, null to clear, undefined to leave as-is.
  const hasImageField = body && "gcashQrImage" in body;
  const gcashQrImage: string | null = body?.gcashQrImage ?? null;

  if (gcashNumber && !/^\d{11}$/.test(gcashNumber)) {
    return NextResponse.json({ error: "GCash number should be 11 digits (e.g. 09171234567)." }, { status: 400 });
  }
  if (hasImageField && gcashQrImage && (!gcashQrImage.startsWith("data:image/") || gcashQrImage.length > MAX_IMG)) {
    return NextResponse.json({ error: "Invalid or too-large QR image (keep it under ~1.5 MB)." }, { status: 400 });
  }

  const data = {
    gcashName: gcashName || null,
    gcashNumber: gcashNumber || null,
    ...(hasImageField ? { gcashQrImage: gcashQrImage || null } : {}),
  };
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
