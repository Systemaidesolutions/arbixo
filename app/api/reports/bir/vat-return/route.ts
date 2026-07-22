import { NextRequest, NextResponse } from "next/server";
import { getVatReturn } from "@/lib/bir";
import { resolveBranchScope } from "@/lib/branchScope";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  if (!companyId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "companyId, dateFrom, and dateTo query parameters are required" },
      { status: 400 }
    );
  }

  const branch = await resolveBranchScope(companyId, params.get("locationId"));

  const result = await getVatReturn(
    companyId,
    new Date(`${dateFrom}T00:00:00`),
    new Date(`${dateTo}T23:59:59.999`),
    branch
  );
  return NextResponse.json(result);
}
