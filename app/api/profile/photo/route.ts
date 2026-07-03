import { NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";

// Serves the signed-in user's profile photo as raw image bytes, decoded from
// the base64 data URL stored on the user row. Keeping this out of the page
// HTML means the header doesn't ship a base64 blob on every navigation.
export async function GET() {
  const user = await getCurrentUserRecord();
  if (!user?.photoUrl) {
    return new NextResponse(null, { status: 404 });
  }
  const match = user.photoUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!match) {
    return new NextResponse(null, { status: 404 });
  }
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime,
      // Per-user and mutable — don't let a shared cache hold a stale face.
      "Cache-Control": "private, no-store",
    },
  });
}
