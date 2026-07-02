import { NextRequest, NextResponse } from "next/server";
import { getBalanceSheet } from "@/lib/reports";

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

  const result = await getBalanceSheet(companyId, new Date(asOfDate), new Date(fiscalYearStart));
  return NextResponse.json(result);
}
