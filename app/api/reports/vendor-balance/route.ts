import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId } from "@/lib/currentUser";
import { getVendorBalanceSummary, getVendorBalanceDetail } from "@/lib/vendorBalances";

export const maxDuration = 60;

// Summary (every vendor with an open balance) by default; pass
// ?vendorId= for that one vendor's open bills/credit notes.
export async function GET(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const vendorId = request.nextUrl.searchParams.get("vendorId");
  if (vendorId) {
    const detail = await getVendorBalanceDetail(companyId, vendorId);
    return NextResponse.json(detail);
  }

  const rows = await getVendorBalanceSummary(companyId);
  return NextResponse.json({ rows });
}
