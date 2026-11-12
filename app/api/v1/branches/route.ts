import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateExternalApi, externalApiError } from "@/lib/externalApiAuth";

// Lets a caller look up the branch codes it can use in the "Branch Code"
// field of a journal-entries batch.
export async function GET(request: NextRequest) {
  const auth = await authenticateExternalApi(request);
  if (!auth.ok) return externalApiError(auth);

  const branches = await prisma.location.findMany({
    where: { companyId: auth.companyId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { name: true, branchCode: true, isDefault: true },
  });
  return NextResponse.json({ branches });
}
