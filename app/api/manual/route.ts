import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";

// Sends the signed-in user to the manual written for their access level —
// Admin, Manager, or User (Report Creator and an unset subtype get the User
// manual, the closest match). An admin currently acting as a company reads
// as a Manager, same as their capabilities do elsewhere (lib/currentUser.ts).
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/api/manual");
    return NextResponse.redirect(loginUrl);
  }

  let file = "ARbixo-User-Manual.docx";
  if (user.role === "ADMIN") {
    file = getAdminActingAsCompanyId() ? "ARbixo-Manager-Manual.docx" : "ARbixo-Admin-Manual.docx";
  } else if (user.subscriberSubtype === "MANAGER") {
    file = "ARbixo-Manager-Manual.docx";
  }

  return NextResponse.redirect(new URL(`/manuals/${file}`, request.url));
}
