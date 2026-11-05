import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { cleanAppList } from "@/lib/appAccess";

// Admin management of a USER account's access to companies BEYOND their
// primary one (User.companyId, which doesn't need a row here — see
// prisma/schema.prisma's CompanyAccess model and lib/userCompanyAccess.ts).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const grants = await prisma.companyAccess.findMany({
    where: { userId: params.id },
    select: { companyId: true, appAccess: true },
  });
  return NextResponse.json({ companyIds: grants.map((g) => g.companyId), grants });
}

// Replaces the full set of additional companies this user can access with
// exactly the list given (simplest to reason about from a checkbox-list
// UI — add missing grants, remove ones no longer checked). Each company can
// carry its own app list ({ grants: [{ companyId, apps }] }); the older
// { companyIds } shape grants both apps.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { companyIds?: string[]; grants?: { companyId?: string; apps?: string[] }[] }
    | null;
  const appsByCompany = new Map<string, string[]>();
  if (body && Array.isArray(body.grants)) {
    for (const g of body.grants) if (g?.companyId) appsByCompany.set(String(g.companyId), cleanAppList(g.apps));
  } else if (body && Array.isArray(body.companyIds)) {
    for (const id of body.companyIds) appsByCompany.set(String(id), ["accounting", "payroll"]);
  } else {
    return NextResponse.json({ error: "grants (array) is required." }, { status: 400 });
  }
  if ([...appsByCompany.values()].some((a) => a.length === 0)) {
    return NextResponse.json({ error: "Tick at least one app (Accounting or Payroll) for each additional company." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, role: true, companyId: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role !== "USER") {
    return NextResponse.json({ error: "Only subscriber accounts can be granted company access." }, { status: 400 });
  }

  // The primary company is always accessible on its own — never store it
  // as a grant, so revoking access here can never accidentally imply
  // revoking their actual home company (that's done by reassigning
  // companyId instead, a separate, more deliberate action).
  const wanted = [...appsByCompany.keys()].filter((id) => id && id !== target.companyId);

  if (wanted.length) {
    const validCompanies = await prisma.company.findMany({ where: { id: { in: wanted } }, select: { id: true } });
    if (validCompanies.length !== wanted.length) {
      return NextResponse.json({ error: "One or more companies weren't found." }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.companyAccess.deleteMany({ where: { userId: target.id, companyId: { notIn: wanted } } }),
    ...wanted.map((companyId) =>
      prisma.companyAccess.upsert({
        where: { userId_companyId: { userId: target.id, companyId } },
        update: { appAccess: appsByCompany.get(companyId) },
        create: { userId: target.id, companyId, grantedById: admin.id, appAccess: appsByCompany.get(companyId) },
      })
    ),
  ]);

  return NextResponse.json({ ok: true, companyIds: wanted });
}
