import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getSummaryListOfSales } from "@/lib/slsp";

export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }

  const result = await getSummaryListOfSales(
    company.id,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`)
  );
  return NextResponse.json(result);
}
