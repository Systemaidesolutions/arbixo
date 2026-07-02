import { NextRequest, NextResponse } from "next/server";
import { getSubsidiaryLedger } from "@/lib/reports";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const partyType = params.get("partyType") as "CUSTOMER" | "VENDOR" | null;
  const partyId = params.get("partyId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  if (!companyId || !partyType || !partyId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "companyId, partyType, partyId, dateFrom, and dateTo query parameters are required" },
      { status: 400 }
    );
  }

  try {
    const result = await getSubsidiaryLedger(companyId, partyType, partyId, new Date(dateFrom), new Date(dateTo));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
