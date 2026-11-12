import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateExternalApi, externalApiError } from "@/lib/externalApiAuth";

// Lets a caller validate/map its own account codes against the company's
// Arbixo chart of accounts before submitting a batch.
export async function GET(request: NextRequest) {
  const auth = await authenticateExternalApi(request);
  if (!auth.ok) return externalApiError(auth);

  const accounts = await prisma.account.findMany({
    where: { companyId: auth.companyId, accountType: "POSTING", isActive: true },
    orderBy: { code: "asc" },
    select: { code: true, title: true, classification: true },
  });
  return NextResponse.json({ accounts });
}
