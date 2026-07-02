import { NextRequest, NextResponse } from "next/server";
import { getMonthlyVatReturn } from "@/lib/bir";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const year = params.get("year");
  const month = params.get("month");

  if (!companyId || !year || !month) {
    return NextResponse.json(
      { error: "companyId, year, and month query parameters are required" },
      { status: 400 }
    );
  }

  const result = await getMonthlyVatReturn(companyId, Number(year), Number(month));
  return NextResponse.json(result);
}
