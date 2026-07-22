import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getSummaryListOfSales, buildSlsDat, reliefDatFilename } from "@/lib/slsp";
import { resolveBranchScope } from "@/lib/branchScope";

// Downloads the BIR RELIEF SLS file (H + D records) for the caller's company.
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }

  const branch = await resolveBranchScope(company.id, request.nextUrl.searchParams.get("locationId"));
  const toDate = new Date(`${to}T23:59:59.999`);
  const sls = await getSummaryListOfSales(company.id, new Date(`${from}T00:00:00`), toDate, branch);
  const text = buildSlsDat(company, sls, toDate);

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reliefDatFilename(company.tin, "S", toDate)}"`,
    },
  });
}
