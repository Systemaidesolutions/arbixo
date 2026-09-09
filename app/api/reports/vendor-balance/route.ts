import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId } from "@/lib/currentUser";
import { getVendorBalanceSummary, getVendorBalanceDetail, getVendorBalanceDetailAll } from "@/lib/vendorBalances";

export const maxDuration = 60;

// Summary (every vendor with an open balance) by default; pass
// ?vendorId= for that one vendor's open bills/credit notes, or
// ?detail=all for the full company-wide detail report (every vendor,
// grouped, in one document). ?dateFrom= / ?dateTo= (either or both) narrow
// every mode to bills/credit notes posted within that range.
export async function GET(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const range = { from: dateFrom ? new Date(dateFrom) : undefined, to: dateTo ? new Date(dateTo) : undefined };

  const vendorId = params.get("vendorId");
  if (vendorId) {
    const detail = await getVendorBalanceDetail(companyId, vendorId, range);
    return NextResponse.json(detail);
  }

  if (params.get("detail") === "all") {
    const detail = await getVendorBalanceDetailAll(companyId, range);
    return NextResponse.json(detail);
  }

  const rows = await getVendorBalanceSummary(companyId, range);
  return NextResponse.json({ rows });
}
