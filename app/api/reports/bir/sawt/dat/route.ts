import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getSummaryAlphalistOfWithholdingTaxes, buildSawtDat } from "@/lib/sawt";

// Downloads the BIR Alphalist SAWT file (H + D + C records).
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const year = Number(request.nextUrl.searchParams.get("year"));
  const quarter = Number(request.nextUrl.searchParams.get("quarter"));
  if (!year || !quarter || quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: "year and quarter (1-4) are required" }, { status: 400 });
  }

  const sawt = await getSummaryAlphalistOfWithholdingTaxes(company.id, year, quarter);
  const text = buildSawtDat(company, sawt);

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="SAWT_${year}_Q${quarter}.DAT"`,
    },
  });
}
