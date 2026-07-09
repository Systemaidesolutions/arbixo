import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import type { IncomePaymentType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const activeOnly = request.nextUrl.searchParams.get("activeOnly") !== "false";
  const atcCodes = await prisma.atcCode.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ atcCodes });
}

export async function POST(request: NextRequest) {
  // ATC codes are global reference data — admin-only writes.
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { code, description, ratePercent } = body;
  if (!code || !description || ratePercent === undefined || ratePercent === null) {
    return NextResponse.json(
      { error: "code, description, and ratePercent are required" },
      { status: 400 }
    );
  }

  const duplicate = await prisma.atcCode.findUnique({ where: { code } });
  if (duplicate) {
    return NextResponse.json({ error: `ATC code "${code}" already exists` }, { status: 409 });
  }

  const atcCode = await prisma.atcCode.create({
    data: {
      code,
      description,
      ratePercent,
      incomePaymentType: (body.incomePaymentType as IncomePaymentType) ?? "BOTH",
    },
  });

  return NextResponse.json({ atcCode }, { status: 201 });
}
