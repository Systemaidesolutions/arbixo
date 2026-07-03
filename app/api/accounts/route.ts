import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_NORMAL_BALANCE } from "@/lib/accounts";
import type { AccountClassification, AccountType, NormalBalance } from "@prisma/client";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query parameter is required" }, { status: 400 });
  }

  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const {
    companyId,
    code,
    title,
    classification,
    normalBalance,
    accountType,
    sortOrder,
    parentAccountId,
    openingBalance,
    openingBalanceDate,
  } = body ?? {};

  if (!companyId || !code || !title || !classification) {
    return NextResponse.json(
      { error: "companyId, code, title, and classification are required" },
      { status: 400 }
    );
  }

  const duplicate = await prisma.account.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (duplicate) {
    return NextResponse.json({ error: `Account code "${code}" is already in use` }, { status: 409 });
  }

  if (parentAccountId) {
    const parent = await prisma.account.findUnique({ where: { id: parentAccountId } });
    if (!parent || parent.companyId !== companyId) {
      return NextResponse.json({ error: "Parent account not found in this company" }, { status: 400 });
    }
    // Parent must be a Heading — posting accounts are always leaves.
    if (parent.accountType !== "HEADING") {
      return NextResponse.json(
        { error: "The parent must be a heading account." },
        { status: 400 }
      );
    }
  }

  const account = await prisma.account.create({
    data: {
      companyId,
      code,
      title,
      classification: classification as AccountClassification,
      accountType: (accountType as AccountType) ?? "POSTING",
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      normalBalance:
        (normalBalance as NormalBalance) ?? DEFAULT_NORMAL_BALANCE[classification as AccountClassification],
      parentAccountId: parentAccountId ?? null,
      openingBalance: openingBalance ?? 0,
      openingBalanceDate: openingBalanceDate ? new Date(openingBalanceDate) : null,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
