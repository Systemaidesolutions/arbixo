import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { getOpenBillsForVendor } from "@/lib/payableApplications";

// Open (not fully paid) Purchase on Account bills for one vendor, for the
// "Apply to bill(s)" picker on Cash Disbursement. Mirrors
// /api/receivables/open-invoices for AR.
export async function GET(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  const cap = await getCurrentCapability();
  if (!cap?.canPost) return NextResponse.json({ error: "Your account is read-only." }, { status: 403 });

  const vendorId = request.nextUrl.searchParams.get("vendorId");
  if (!vendorId) return NextResponse.json({ error: "vendorId is required." }, { status: 400 });

  const bills = await getOpenBillsForVendor(companyId, vendorId);
  return NextResponse.json({ bills });
}
