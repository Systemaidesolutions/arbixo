import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: decodes a stored brand-image data URL and serves the raw bytes so
// it can be used as an <img src> or CSS background. 404 when not set.
export async function GET(_request: Request, { params }: { params: { slot: string } }) {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) return new NextResponse(null, { status: 404 });

  const dataUrl =
    params.slot === "background"
      ? settings.backgroundImage
      : params.slot === "login"
        ? settings.loginImage
        : params.slot === "header-logo"
          ? settings.headerLogo
          : null;
  if (!dataUrl) return new NextResponse(null, { status: 404 });

  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return new NextResponse(null, { status: 404 });

  const buffer = Buffer.from(match[2], "base64");
  return new NextResponse(buffer, {
    status: 200,
    headers: { "Content-Type": match[1], "Cache-Control": "public, max-age=60" },
  });
}
