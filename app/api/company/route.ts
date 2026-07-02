import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";

// TODO: once auth exists, scope this to the signed-in user's company
// instead of "the only company row". For now the app assumes a single
// company, matching the manual's one-time "Setup Company" step.

export async function GET() {
  const company = await prisma.company.findFirst();
  return NextResponse.json({ company });
}

export async function POST(request: NextRequest) {
  const existing = await prisma.company.findFirst();
  if (existing) {
    return NextResponse.json(
      { error: "A company is already set up. Use PATCH /api/company to edit it." },
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

  const company = await prisma.company.create({ data: body });
  return NextResponse.json({ company }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const existing = await prisma.company.findFirst();
  if (!existing) {
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
    where: { id: existing.id },
    data: body,
  });
  return NextResponse.json({ company });
}
