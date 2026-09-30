import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getAccessibleCompanyIds, ACTIVE_COMPANY_COOKIE, setActiveCompanyCookie } from "@/lib/userCompanyAccess";

// A USER account switches which of their accessible companies (primary +
// any CompanyAccess grants, see lib/userCompanyAccess.ts) the rest of this
// browser session works against.
export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER") {
    return NextResponse.json({ error: "Only subscriber accounts can switch companies." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { companyId?: string } | null;
  if (!body?.companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });

  const allowed = await getAccessibleCompanyIds(user.id, user.companyId);
  if (!allowed.includes(body.companyId)) {
    return NextResponse.json({ error: "You don't have access to that company." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  setActiveCompanyCookie(response, body.companyId);
  return response;
}

// Back to the user's primary company.
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_COMPANY_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
