import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";

// A signed-in user editing their own profile: display name + photo. Email
// is the login identity and is intentionally not editable here.
export async function PATCH(req: Request) {
  const user = await getCurrentUserRecord();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const data: { name?: string | null; photoUrl?: string | null } = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    data.name = name.length > 0 ? name.slice(0, 120) : null;
  }

  if ("photoUrl" in body) {
    const photo = body.photoUrl;
    if (photo === null || photo === "") {
      data.photoUrl = null;
    } else if (typeof photo === "string" && photo.startsWith("data:image/")) {
      // Base64 data URLs are ~4/3 the byte size; cap around ~2MB of image.
      if (photo.length > 2_800_000) {
        return NextResponse.json(
          { error: "Photo is too large. Please use an image under 2MB." },
          { status: 400 }
        );
      }
      data.photoUrl = photo;
    } else {
      return NextResponse.json({ error: "Invalid image." }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
