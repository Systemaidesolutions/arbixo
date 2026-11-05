import { NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { cleanDenied } from "@/lib/userPermissions";

// The signed-in user's removed access groups (lib/userPermissions.ts). Called
// by middleware.ts before gated API requests; it can't read the database on
// the edge. Platform admins (including acting inside a company) have none.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUserRecord();
  if (!user || user.isDisabled) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const denied = user.role === "ADMIN" ? [] : cleanDenied(user.deniedPermissions);
  return NextResponse.json({ denied }, { headers: { "Cache-Control": "no-store" } });
}
