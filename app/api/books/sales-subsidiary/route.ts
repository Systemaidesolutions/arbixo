import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getSalesSubsidiaryJournal } from "@/lib/salesSubsidiaryJournal";
import { resolveBranchScope } from "@/lib/branchScope";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const user = await getCurrentUserRecord();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branch = await resolveBranchScope(user.companyId, params.get("locationId"));

  const result = await getSalesSubsidiaryJournal(
    user.companyId,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`),
    branch
  );
  return NextResponse.json(result);
}
