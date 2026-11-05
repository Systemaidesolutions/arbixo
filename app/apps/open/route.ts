import { NextRequest, NextResponse } from "next/server";
import { APP_COOKIE, APP_HOME, type AppKey } from "@/lib/navigation";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { resolveActiveCompanyApps } from "@/lib/userCompanyAccess";

// Remembers the app picked on /apps and opens its home page.
export async function GET(request: NextRequest) {
  const wanted: AppKey = request.nextUrl.searchParams.get("app") === "payroll" ? "payroll" : "accounting";
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  // An app the user isn't assigned opens their (first) allowed app instead.
  const allowed = await resolveActiveCompanyApps(user);
  const app: AppKey = allowed.includes(wanted) ? wanted : allowed[0];
  const res = NextResponse.redirect(new URL(APP_HOME[app], request.url));
  res.cookies.set(APP_COOKIE, app, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
