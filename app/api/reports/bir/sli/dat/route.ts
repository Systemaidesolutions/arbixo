import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getSummaryListOfImportations, buildSliDat, reliefDatFilename } from "@/lib/slsp";

// Downloads the BIR RELIEF SLI file (H + D records) for the caller's company.
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }

  const toDate = new Date(`${to}T23:59:59.999`);
  const sli = await getSummaryListOfImportations(company.id, new Date(`${from}T00:00:00`), toDate);
  const text = buildSliDat(company, sli, toDate);

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reliefDatFilename(company.tin, "I", toDate)}"`,
    },
  });
}
