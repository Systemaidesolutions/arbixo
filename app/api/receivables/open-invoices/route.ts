import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { getOpenInvoicesForCustomer } from "@/lib/receivableApplications";

// Open (not fully paid) Sales on Account invoices for one customer, for the
// "Apply to invoice(s)" picker on Cash Receipts.
export async function GET(request: NextRequest) {
  const companyId = await effectiveCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 403 });
  const cap = await getCurrentCapability();
  if (!cap?.canPost) return NextResponse.json({ error: "Your account is read-only." }, { status: 403 });

  const customerId = request.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "customerId is required." }, { status: 400 });

  const invoices = await getOpenInvoicesForCustomer(companyId, customerId);
  return NextResponse.json({ invoices });
}
