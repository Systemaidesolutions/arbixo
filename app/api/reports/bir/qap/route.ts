import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getQuarterlyAlphalistOfPayees } from "@/lib/qap";

// Quarterly Alphalist of Payees (EWT) for the caller's company.
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const year = Number(request.nextUrl.searchParams.get("year"));
  const quarter = Number(request.nextUrl.searchParams.get("quarter"));
  if (!year || !quarter || quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: "year and quarter (1-4) are required" }, { status: 400 });
  }

  const qap = await getQuarterlyAlphalistOfPayees(company.id, year, quarter);
  return NextResponse.json(qap);
}
