import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query parameter is required" }, { status: 400 });
  }
  const setup = await prisma.taxPostingSetup.findUnique({ where: { companyId } });
  return NextResponse.json({ setup });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const setup = await prisma.taxPostingSetup.upsert({
    where: { companyId: body.companyId },
    update: {
      inputVatAccountId: body.inputVatAccountId ?? null,
      outputVatAccountId: body.outputVatAccountId ?? null,
      withholdingTaxPayableAccountId: body.withholdingTaxPayableAccountId ?? null,
    },
    create: {
      companyId: body.companyId,
      inputVatAccountId: body.inputVatAccountId ?? null,
      outputVatAccountId: body.outputVatAccountId ?? null,
      withholdingTaxPayableAccountId: body.withholdingTaxPayableAccountId ?? null,
    },
  });

  return NextResponse.json({ setup });
}
