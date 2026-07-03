import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/defaultChartOfAccounts";

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

  // Seed the standard chart of accounts so a new company can post right away;
  // it stays fully editable in the Chart of Accounts screen.
  await prisma.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ ...a, companyId: company.id })),
  });

  return NextResponse.json({ company }, { status: 201 });
}
