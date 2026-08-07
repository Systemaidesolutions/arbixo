import { NextResponse } from "next/server";
import { ACTING_AS_COOKIE } from "@/lib/adminActingAs";

// Ends an admin's "acting as" session (lib/adminActingAs.ts). No admin check
// needed — clearing this cookie can only ever narrow access.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTING_AS_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
