import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";
import { invalidateAuditCache } from "@/lib/auditSettings";

// Admin edits an existing company. Subscribers get a read-only view of
// their own company; all edits go through here.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as
    | (Partial<CompanyFormPayload> & { auditLogEnabled?: boolean })
    | null;
  if (!raw) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  // Settings-only toggle (audit logging on/off) — not the full company form.
  if (typeof raw.auditLogEnabled === "boolean") {
    const existing = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    await prisma.company.update({
      where: { id: params.id },
      data: { auditLogEnabled: raw.auditLogEnabled },
    });
    invalidateAuditCache(params.id);
    return NextResponse.json({ ok: true, auditLogEnabled: raw.auditLogEnabled });
  }

  const body = raw as CompanyFormPayload;
  const validationError = validateCompanyPayload(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const existing = await prisma.company.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const company = await prisma.company.update({ where: { id: params.id }, data: body });
  return NextResponse.json({ company });
}
