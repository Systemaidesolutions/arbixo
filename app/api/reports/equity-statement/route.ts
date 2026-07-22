import { NextRequest, NextResponse } from "next/server";
import { getEquityStatement } from "@/lib/reports";
import { resolveBranchScope } from "@/lib/branchScope";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  if (!companyId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "companyId, dateFrom, and dateTo are required" }, { status: 400 });
  }
  const branch = await resolveBranchScope(companyId, params.get("locationId"));

  try {
    const result = await getEquityStatement(companyId, new Date(dateFrom), new Date(dateTo), branch);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
