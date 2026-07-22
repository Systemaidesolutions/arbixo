import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { getAlphalistOfPayees, buildQapDat, qapDatFilename, tinBranchCode } from "@/lib/qap";
import { resolveBranchScope } from "@/lib/branchScope";

// Downloads the BIR Alphalist QAP file (H + D records) for the caller's company.
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });

  const locationId = request.nextUrl.searchParams.get("locationId") || undefined;
  const branch = await resolveBranchScope(company.id, locationId);
  const toDate = new Date(`${to}T23:59:59.999`);
  const qap = await getAlphalistOfPayees(company.id, new Date(`${from}T00:00:00`), toDate, branch);
  const text = buildQapDat(company, qap, toDate);

  // Branch code for the filename. For a single selected branch: its explicit
  // branch code, else its TIN suffix. For the consolidated file (all branches):
  // the company's default branch code (head office → 000). Falls back to the
  // company's own TIN suffix if no branch/default is set.
  let branchCode = tinBranchCode(company.tin);
  const loc = await prisma.location.findFirst({
    where: locationId ? { id: locationId, companyId: company.id } : { companyId: company.id, isDefault: true },
    select: { branchCode: true, tin: true },
  });
  if (loc) {
    const explicit = (loc.branchCode ?? "").replace(/\D/g, "");
    if (explicit) branchCode = explicit;
    else if (loc.tin) branchCode = tinBranchCode(loc.tin);
  }
  // Reports use only the LAST 4 characters of the 5-digit branch code.
  const report4 = branchCode.replace(/\D/g, "").padStart(5, "0").slice(-4);
  const filename = qapDatFilename(company.tin, report4, toDate);

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
