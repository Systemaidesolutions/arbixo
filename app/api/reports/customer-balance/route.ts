import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId } from "@/lib/currentUser";
import { getCustomerBalanceSummary, getCustomerBalanceDetail } from "@/lib/customerBalances";

export const maxDuration = 60;

// Summary (every customer with an open balance) by default; pass
// ?customerId= for that one customer's open invoices/credit notes.
export async function GET(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customerId = request.nextUrl.searchParams.get("customerId");
  if (customerId) {
    const detail = await getCustomerBalanceDetail(companyId, customerId);
    return NextResponse.json(detail);
  }

  const rows = await getCustomerBalanceSummary(companyId);
  return NextResponse.json({ rows });
}
