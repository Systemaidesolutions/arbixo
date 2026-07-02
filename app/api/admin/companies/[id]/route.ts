import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";

// Admin edits an existing company. Subscribers get a read-only view of
// their own company; all edits go through here.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as CompanyFormPayload | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const validationError = validateCompanyPayload(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const existing = await prisma.company.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const company = await prisma.company.update({ where: { id: params.id }, data: body });
  return NextResponse.json({ company });
}
