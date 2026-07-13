import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";

// Download a single attachment (decodes its base64 data URL to binary).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserRecord();
  if (!user?.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const att = await prisma.transactionAttachment.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const m = att.data.match(/^data:([^;]*);base64,(.*)$/);
  const contentType = att.contentType || m?.[1] || "application/octet-stream";
  const b64 = m ? m[2] : att.data;
  const buf = Buffer.from(b64, "base64");

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${att.fileName.replace(/"/g, "")}"`,
      "Content-Length": String(buf.length),
    },
  });
}
