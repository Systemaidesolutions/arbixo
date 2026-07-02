import { NextRequest, NextResponse } from "next/server";
import { getIncomeStatement } from "@/lib/reports";

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

  const result = await getIncomeStatement(companyId, new Date(dateFrom), new Date(dateTo));
  return NextResponse.json(result);
}
