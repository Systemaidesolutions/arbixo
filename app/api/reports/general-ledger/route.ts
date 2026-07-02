import { NextRequest, NextResponse } from "next/server";
import { getGeneralLedger } from "@/lib/reports";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const accountId = params.get("accountId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  if (!companyId || !accountId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "companyId, accountId, dateFrom, and dateTo query parameters are required" },
      { status: 400 }
    );
  }

  try {
    const result = await getGeneralLedger(companyId, accountId, new Date(dateFrom), new Date(dateTo));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
