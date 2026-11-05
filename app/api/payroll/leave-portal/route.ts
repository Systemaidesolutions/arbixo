import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payrollAuth } from "@/lib/payroll/server";
import { generatePortalCode } from "@/lib/leavePortalRules";

// Payroll staff turn the employee leave portal on/off, or replace its link.
// Body: { enabled?: boolean; newLink?: boolean }.
export async function PUT(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);

  const company = await prisma.company.findUnique({ where: { id: auth.companyId }, select: { leavePortalCode: true } });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const data: { leavePortalEnabled?: boolean; leavePortalCode?: string } = {};
  if (typeof body?.enabled === "boolean") data.leavePortalEnabled = body.enabled;
  // A link is created the first time; "new link" replaces it so the old one stops working.
  if (!company.leavePortalCode || body?.newLink === true) data.leavePortalCode = generatePortalCode();

  const saved = await prisma.company.update({
    where: { id: auth.companyId },
    data,
    select: { leavePortalEnabled: true, leavePortalCode: true },
  });
  return NextResponse.json({ ok: true, ...saved });
}
