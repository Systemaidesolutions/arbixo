import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getSummaryListOfImportations } from "@/lib/slsp";

// Summary List of Importations for the caller's company over a date range.
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }

  const sli = await getSummaryListOfImportations(
    company.id,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`)
  );
  return NextResponse.json(sli);
}
