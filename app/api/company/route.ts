import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, effectiveCompanyId } from "@/lib/currentUser";

// Read-only for subscribers. Company records are created and edited by an
// Arbixo admin via /api/admin/companies — subscribers can only view their
// own company, never create or change it. An admin acting inside a company
// (lib/adminActingAs.ts) gets the same read access here, but still edits
// via /api/admin/companies, not this route.
export async function GET() {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ company: null });

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  return NextResponse.json({ company });
}

const MANAGED_BY_ADMIN = {
  error: "Company details are managed by your administrator and can't be changed here.",
};

export async function POST() {
  return NextResponse.json(MANAGED_BY_ADMIN, { status: 403 });
}

export async function PATCH() {
  return NextResponse.json(MANAGED_BY_ADMIN, { status: 403 });
}
