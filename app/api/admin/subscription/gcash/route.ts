import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
    select: { gcashName: true, gcashNumber: true },
  });
  return NextResponse.json({ gcashName: settings?.gcashName ?? "", gcashNumber: settings?.gcashNumber ?? "" });
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const gcashName = typeof body?.gcashName === "string" ? body.gcashName.trim() : "";
  const gcashNumber = typeof body?.gcashNumber === "string" ? body.gcashNumber.replace(/[^\d]/g, "") : "";

  if (gcashNumber && !/^\d{11}$/.test(gcashNumber)) {
    return NextResponse.json({ error: "GCash number should be 11 digits (e.g. 09171234567)." }, { status: 400 });
  }

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", gcashName: gcashName || null, gcashNumber: gcashNumber || null },
    update: { gcashName: gcashName || null, gcashNumber: gcashNumber || null },
  });
  return NextResponse.json({ ok: true, gcashName, gcashNumber });
}
