import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId } from "@/lib/currentUser";
import { getCustomerBalanceSummary, getCustomerBalanceDetail, getCustomerBalanceDetailAll } from "@/lib/customerBalances";

export const maxDuration = 60;

// Summary (every customer with an open balance) by default; pass
// ?customerId= for that one customer's open invoices/credit notes, or
// ?detail=all for the full company-wide detail report (every customer,
// grouped, in one document). ?dateFrom= / ?dateTo= (either or both) narrow
// every mode to invoices/credit notes posted within that range.
export async function GET(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const range = { from: dateFrom ? new Date(dateFrom) : undefined, to: dateTo ? new Date(dateTo) : undefined };

  const customerId = params.get("customerId");
  if (customerId) {
    const detail = await getCustomerBalanceDetail(companyId, customerId, range);
    return NextResponse.json(detail);
  }

  if (params.get("detail") === "all") {
    const detail = await getCustomerBalanceDetailAll(companyId, range);
    return NextResponse.json(detail);
  }

  const rows = await getCustomerBalanceSummary(companyId, range);
  return NextResponse.json({ rows });
}
