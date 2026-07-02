import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";

export async function GET() {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.companyId) return NextResponse.json({ company: null });

  const company = await prisma.company.findUnique({ where: { id: user.companyId } });
  return NextResponse.json({ company });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "USER") {
    return NextResponse.json(
      { error: "Admin accounts don't have their own company. Log in as a subscriber account instead." },
      { status: 403 }
    );
  }
  if (user.companyId) {
    return NextResponse.json(
      { error: "You already have a company set up. Use PATCH /api/company to edit it." },
      { status: 409 }
    );
  }

  const body = (await request.json().catch(() => null)) as CompanyFormPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validationError = validateCompanyPayload(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Create the company and attach it to this user as one transaction —
  // a company that exists but isn't linked to anyone would be an orphan
  // no page could ever reach again, since every lookup goes through the
  // user's own companyId now.
  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: body });
    await tx.user.update({ where: { id: user.id }, data: { companyId: created.id } });
    return created;
  });

  return NextResponse.json({ company }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.companyId) {
    return NextResponse.json(
      { error: "No company exists yet. Use POST /api/company to create one." },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => null)) as CompanyFormPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validationError = validateCompanyPayload(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const company = await prisma.company.update({
    where: { id: user.companyId },
    data: body,
  });
  return NextResponse.json({ company });
}
