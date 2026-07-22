import { NextRequest, NextResponse } from "next/server";
import { getBalanceSheet } from "@/lib/reports";
import { resolveBranchScope } from "@/lib/branchScope";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const asOfDate = params.get("asOfDate");
  const fiscalYearStart = params.get("fiscalYearStart");

  if (!companyId || !asOfDate || !fiscalYearStart) {
    return NextResponse.json(
      { error: "companyId, asOfDate, and fiscalYearStart query parameters are required" },
      { status: 400 }
    );
  }

  const branch = await resolveBranchScope(companyId, params.get("locationId"));

  const result = await getBalanceSheet(companyId, new Date(asOfDate), new Date(fiscalYearStart), branch);
  return NextResponse.json(result);
}
