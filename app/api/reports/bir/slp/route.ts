import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getSummaryListOfPurchases } from "@/lib/slsp";
import { resolveBranchScope } from "@/lib/branchScope";

export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }

  const branch = await resolveBranchScope(company.id, request.nextUrl.searchParams.get("locationId"));
  const result = await getSummaryListOfPurchases(
    company.id,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`),
    branch
  );
  return NextResponse.json(result);
}
