import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";
import { seedDefaultChart } from "@/lib/seedChart";
import { createTicketProjectForCompany } from "@/lib/ticketingSync";

// Admin creates a company. It's created unassigned — assigning it to one or
// more subscriber users is a separate step (PATCH /api/admin/users/[id]),
// because a company can have many users.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as CompanyFormPayload | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const validationError = validateCompanyPayload(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const company = await prisma.company.create({ data: body });

  // Seed the standard nested heading chart; posting accounts are added
  // afterward in the Chart of Accounts screen.
  await seedDefaultChart(company.id);

  // Best-effort: create a matching project in the ARbixo Core ticketing app.
  // Never let a ticketing failure block company creation.
  const ticketProjectKey = await createTicketProjectForCompany(company);
  if (ticketProjectKey) {
    await prisma.company.update({ where: { id: company.id }, data: { ticketProjectKey } });
    company.ticketProjectKey = ticketProjectKey;
  }

  return NextResponse.json({ company }, { status: 201 });
}
