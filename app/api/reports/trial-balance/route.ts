import { NextRequest, NextResponse } from "next/server";
import { getTrialBalance } from "@/lib/reports";
import { resolveBranchScope } from "@/lib/branchScope";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const mode = params.get("mode") as "YEAR_TO_DATE" | "NET_CHANGE" | null;

  if (!companyId || !mode) {
    return NextResponse.json({ error: "companyId and mode query parameters are required" }, { status: 400 });
  }

  const branch = await resolveBranchScope(companyId, params.get("locationId"));

  try {
    if (mode === "YEAR_TO_DATE") {
      const asOfDate = params.get("asOfDate");
      if (!asOfDate) {
        return NextResponse.json({ error: "asOfDate is required for YEAR_TO_DATE mode" }, { status: 400 });
      }
      const result = await getTrialBalance(companyId, { mode, asOfDate: new Date(asOfDate), branch });
      return NextResponse.json(result);
    }

    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "dateFrom and dateTo are required for NET_CHANGE mode" },
        { status: 400 }
      );
    }
    const result = await getTrialBalance(companyId, {
      mode,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      branch,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
