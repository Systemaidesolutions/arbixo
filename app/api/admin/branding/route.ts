import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import type { Prisma } from "@prisma/client";

// Data-URL cap (~1.5 MB image once base64 overhead is included).
const MAX = 2 * 1024 * 1024;
const SLOTS = { background: "backgroundImage", login: "loginImage", "header-logo": "headerLogo" } as const;

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { slot?: string; dataUrl?: string | null } | null;
  if (!body?.slot || !(body.slot in SLOTS)) {
    return NextResponse.json({ error: "Invalid image slot." }, { status: 400 });
  }
  const dataUrl = body.dataUrl ?? null;
  if (dataUrl && (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX)) {
    return NextResponse.json({ error: "Invalid or too-large image (keep it under ~1.5 MB)." }, { status: 400 });
  }

  const field = SLOTS[body.slot as keyof typeof SLOTS];
  const value: Prisma.AppSettingsUpdateInput = {};
  if (field === "backgroundImage") value.backgroundImage = dataUrl;
  else if (field === "loginImage") value.loginImage = dataUrl;
  else value.headerLogo = dataUrl;

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: value,
    create: { id: "singleton", ...value } as Prisma.AppSettingsCreateInput,
  });

  return NextResponse.json({ ok: true });
}
