import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getSummaryAlphalistOfWithholdingTaxes, buildSawtDat } from "@/lib/sawt";

// Downloads the BIR Alphalist SAWT file (H + D + C records).
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });

  const locationId = request.nextUrl.searchParams.get("locationId") || undefined;
  const toDate = new Date(`${to}T23:59:59.999`);
  const sawt = await getSummaryAlphalistOfWithholdingTaxes(company.id, new Date(`${from}T00:00:00`), toDate, locationId);
  const text = buildSawtDat(company, sawt, toDate);

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="SAWT_${from}_to_${to}.DAT"`,
    },
  });
}
