import { NextRequest, NextResponse } from "next/server";
import { APP_COOKIE, APP_HOME, type AppKey } from "@/lib/navigation";

// Remembers the app picked on /apps and opens its home page.
export function GET(request: NextRequest) {
  const app: AppKey = request.nextUrl.searchParams.get("app") === "payroll" ? "payroll" : "accounting";
  const res = NextResponse.redirect(new URL(APP_HOME[app], request.url));
  res.cookies.set(APP_COOKIE, app, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
