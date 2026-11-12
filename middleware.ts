import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { apiRequirement, deniedMessage, unmet } from "@/lib/userPermissions";
// Same value as PATH_HEADER in lib/appAccess.ts (not imported: edge bundle).
const PATH_HEADER = "x-arbixo-path";

// "/leave" + "/api/leave-portal" = employee leave portal; it has its own
// employee-code + PIN sign-in (lib/leavePortal.ts), not an ARbixo account.
// "/api/v1" = the external integration API (app/api/v1/**); it authenticates
// itself via an API key (lib/externalApiAuth.ts), not a session cookie, so it
// must bypass the session check here. "/developers" is its public,
// no-login-required documentation page.
const PUBLIC_PREFIXES = ["/login", "/register", "/verify", "/reset-password", "/forgot-password", "/api/auth", "/leave", "/api/leave-portal", "/api/v1", "/developers"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // "/" is the public marketing landing page. Matched exactly — a prefix
  // match on "/" would make the entire app public.
  if (pathname === "/") return NextResponse.next();

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Access groups (Admin › User access, lib/userPermissions.ts): gated API
  // requests (writes, file generation, printing) are checked here, the one
  // place every route passes through. Pages are checked in app/(app)/layout.
  if (session.role !== "ADMIN") {
    let referer = "";
    try {
      const r = request.headers.get("referer");
      if (r) referer = new URL(r).pathname;
    } catch {}
    const req = apiRequirement(pathname, request.method, referer);
    if (req.length) {
      const res = await fetch(new URL("/api/auth/access", request.url), {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      }).catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as { denied?: string[] } | null) : null;
      if (!body?.denied) return NextResponse.json({ error: "Could not check your access. Please try again." }, { status: 503 });
      const missing = unmet(body.denied, req);
      if (missing) return NextResponse.json({ error: deniedMessage(missing) }, { status: 403 });
    }
  }

  // Lets pages and API routes check the user's app access (lib/appAccess.ts).
  const forwarded = new Headers(request.headers);
  forwarded.set(PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  // Everything except Next's internal assets and the logo files —
  // those need to load on the login page too, before anyone is
  // authenticated.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|arbixo-logo.jpg|arbixo-logo-nav.png|arbixo-icon.png|arbixo-wordmark.png|login-footer-logo.png|bir-registered-badge.jpg|arbi-help-avatar-v2.png|email-banner.jpg).*)"],
};
