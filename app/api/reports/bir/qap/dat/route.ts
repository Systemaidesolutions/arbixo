import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { getAlphalistOfPayees, buildQapDat, qapDatFilename, tinBranchCode } from "@/lib/qap";

// Downloads the BIR Alphalist QAP file (H + D records) for the caller's company.
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });

  const locationId = request.nextUrl.searchParams.get("locationId") || undefined;
  const toDate = new Date(`${to}T23:59:59.999`);
  const qap = await getAlphalistOfPayees(company.id, new Date(`${from}T00:00:00`), toDate, locationId);
  const text = buildQapDat(company, qap, toDate);

  // Branch code for the filename: the selected branch's TIN when filtering by
  // one, otherwise the company's own TIN (head office → 000).
  let branchTin: string | null = company.tin;
  if (locationId) {
    const loc = await prisma.location.findUnique({ where: { id: locationId }, select: { tin: true } });
    if (loc?.tin) branchTin = loc.tin;
  }
  const filename = qapDatFilename(company.tin, tinBranchCode(branchTin), toDate);

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
