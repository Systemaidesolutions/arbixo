import { NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";

// Serves the signed-in company's logo as raw image bytes, decoded from the
// base64 data URL stored on the company. Used by the header so each company
// shows its own branding.
export async function GET() {
  const company = await getCurrentCompany();
  if (!company?.logoUrl) {
    return new NextResponse(null, { status: 404 });
  }
  const match = company.logoUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!match) {
    return new NextResponse(null, { status: 404 });
  }
  const [, mime, b64] = match;
  return new NextResponse(Buffer.from(b64, "base64"), {
    headers: { "Content-Type": mime, "Cache-Control": "private, no-store" },
  });
}
