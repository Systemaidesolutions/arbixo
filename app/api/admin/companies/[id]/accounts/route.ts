import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { AccountClassification } from "@prisma/client";

// A given company's posting accounts, for admin pickers (e.g. which account
// ARbixo's own subscription revenue posts to — Subscription > Business
// profile). Optional ?classification= filters to one AccountClassification.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const classificationParam = request.nextUrl.searchParams.get("classification");
  const classification =
    classificationParam && classificationParam in AccountClassification
      ? (classificationParam as AccountClassification)
      : undefined;

  const accounts = await prisma.account.findMany({
    where: {
      companyId: params.id,
      accountType: "POSTING",
      isActive: true,
      ...(classification ? { classification } : {}),
    },
    select: { id: true, code: true, title: true, classification: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ accounts });
}
