import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Serves a related link's logo as raw image bytes, decoded from the stored
// base64 data URL. Public (these are just logos of public websites) and
// cacheable, so the dashboard doesn't ship the blob in its HTML.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const link = await prisma.relatedLink.findUnique({
    where: { id: params.id },
    select: { logoUrl: true },
  });
  if (!link?.logoUrl) {
    return new NextResponse(null, { status: 404 });
  }
  const match = link.logoUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!match) {
    return new NextResponse(null, { status: 404 });
  }
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=300",
    },
  });
}
