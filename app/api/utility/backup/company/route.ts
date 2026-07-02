import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { buildCompanyBackup, slugify } from "@/lib/backup";

// Per-company backup. Admins can back up any company; a Manager can back up
// only their own.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isAdmin = user.role === "ADMIN";
  const isManager = capabilitiesFor(user.role, user.subscriberSubtype).canApprove;
  if (!isAdmin && !isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requested = request.nextUrl.searchParams.get("companyId");
  const companyId = isAdmin ? requested : user.companyId;
  if (!companyId) return NextResponse.json({ error: "No company specified." }, { status: 400 });
  if (isManager && companyId !== user.companyId) {
    return NextResponse.json({ error: "You can only back up your own company." }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { tradeName: true } });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const data = await buildCompanyBackup(companyId);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `arbixo-backup-${slugify(company.tradeName)}-${date}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
