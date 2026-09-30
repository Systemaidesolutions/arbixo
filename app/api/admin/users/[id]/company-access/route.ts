import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";

// Admin management of a USER account's access to companies BEYOND their
// primary one (User.companyId, which doesn't need a row here — see
// prisma/schema.prisma's CompanyAccess model and lib/userCompanyAccess.ts).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const grants = await prisma.companyAccess.findMany({
    where: { userId: params.id },
    select: { companyId: true },
  });
  return NextResponse.json({ companyIds: grants.map((g) => g.companyId) });
}

// Replaces the full set of additional companies this user can access with
// exactly the list given (simplest to reason about from a checkbox-list
// UI — add missing grants, remove ones no longer checked).
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { companyIds?: string[] } | null;
  if (!body || !Array.isArray(body.companyIds)) {
    return NextResponse.json({ error: "companyIds (array) is required." }, { status: 400 });
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
  const wanted = [...new Set(body.companyIds)].filter((id) => id && id !== target.companyId);

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
        update: {},
        create: { userId: target.id, companyId, grantedById: admin.id },
      })
    ),
  ]);

  return NextResponse.json({ ok: true, companyIds: wanted });
}
