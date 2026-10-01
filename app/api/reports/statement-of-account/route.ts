import { NextRequest, NextResponse } from "next/server";
import { getStatementOfAccount } from "@/lib/reports";
import { resolveBranchScope } from "@/lib/branchScope";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const customerId = params.get("customerId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  if (!companyId || !customerId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "companyId, customerId, dateFrom, and dateTo query parameters are required" },
      { status: 400 }
    );
  }

  const branch = await resolveBranchScope(companyId, params.get("locationId"));

  try {
    const result = await getStatementOfAccount(companyId, customerId, new Date(dateFrom), new Date(dateTo), branch);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
