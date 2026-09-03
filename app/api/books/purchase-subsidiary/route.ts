import { NextRequest, NextResponse } from "next/server";
import { effectiveCompanyId } from "@/lib/currentUser";
import { getPurchaseSubsidiaryJournal } from "@/lib/purchaseSubsidiaryJournal";
import { resolveBranchScope } from "@/lib/branchScope";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  // effectiveCompanyId (not a raw user.companyId check) so this also works
  // for an admin currently acting inside a company — a plain ADMIN account
  // has no companyId of its own and would otherwise always get Forbidden.
  const companyId = await effectiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branch = await resolveBranchScope(companyId, params.get("locationId"));

  const result = await getPurchaseSubsidiaryJournal(
    companyId,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`),
    branch
  );
  return NextResponse.json(result);
}
