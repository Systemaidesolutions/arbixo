import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import type { IncomePaymentType } from "@prisma/client";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.atcCode.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "ATC code not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const atcCode = await prisma.atcCode.update({
    where: { id: params.id },
    data: {
      description: body.description ?? undefined,
      ratePercent: body.ratePercent ?? undefined,
      incomePaymentType: (body.incomePaymentType as IncomePaymentType) ?? undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    },
  });

  return NextResponse.json({ atcCode });
}

// No hard delete — an ATC code used on a historical ledger entry must
// keep meaning even if BIR retires it. Deactivate instead (isActive via
// PATCH), which hides it from new-entry dropdowns without touching
// history. This DELETE only exists to reject that expectation clearly.
export async function DELETE() {
  return NextResponse.json(
    { error: "ATC codes can't be deleted — set isActive to false instead to preserve history." },
    { status: 405 }
  );
}
