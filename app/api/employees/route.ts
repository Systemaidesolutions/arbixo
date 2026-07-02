import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query parameter is required" }, { status: 400 });
  }
  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, code, lastName, firstName } = body;
  if (!companyId || !code || !lastName?.trim() || !firstName?.trim()) {
    return NextResponse.json(
      { error: "companyId, code, lastName, and firstName are required" },
      { status: 400 }
    );
  }

  const duplicate = await prisma.employee.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (duplicate) {
    return NextResponse.json({ error: `Employee code "${code}" is already in use` }, { status: 409 });
  }

  const employee = await prisma.employee.create({
    data: {
      companyId,
      code,
      tin: body.tin ?? null,
      lastName,
      firstName,
      middleName: body.middleName ?? null,
      position: body.position ?? null,
      address: body.address ?? null,
      telNo: body.telNo ?? null,
      cellNo: body.cellNo ?? null,
      email: body.email ?? null,
    },
  });

  return NextResponse.json({ employee }, { status: 201 });
}
