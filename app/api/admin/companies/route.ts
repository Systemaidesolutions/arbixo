import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";

// Admin creates a company and assigns it to exactly one subscriber account.
// Subscribers can no longer create their own company — this is the only
// creation path now.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | (CompanyFormPayload & { userId?: string })
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { userId, ...companyPayload } = body;
  if (!userId) return NextResponse.json({ error: "A subscriber must be selected" }, { status: 400 });

  const validationError = validateCompanyPayload(companyPayload);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  if (target.role !== "USER") {
    return NextResponse.json(
      { error: "Companies can only be assigned to subscriber (USER) accounts." },
      { status: 400 }
    );
  }
  if (target.companyId) {
    return NextResponse.json(
      { error: "That subscriber already has a company assigned." },
      { status: 409 }
    );
  }

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: companyPayload });
    await tx.user.update({ where: { id: target.id }, data: { companyId: created.id } });
    return created;
  });

  return NextResponse.json({ company }, { status: 201 });
}
