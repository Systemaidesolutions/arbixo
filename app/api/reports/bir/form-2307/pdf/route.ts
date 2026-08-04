import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { get2307Payees } from "@/lib/form2307";
import { resolveBranchScope } from "@/lib/branchScope";
import { renderForm2307Pdf, type Form2307Data } from "@/lib/form2307Pdf";

// One or every payee's BIR 2307 certificate for the period, stamped onto
// BIR's own blank form and returned as a single PDF (one cert per payee,
// 2 pages each — see lib/form2307Pdf.ts).
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }

  const branch = await resolveBranchScope(company.id, sp.get("locationId"));
  const { payees } = await get2307Payees(
    company.id,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`),
    branch
  );

  const payeeId = sp.get("payeeId");
  const selected = payeeId ? payees.filter((p) => p.id === payeeId) : payees;
  if (selected.length === 0) {
    return NextResponse.json({ error: "No payees for this period." }, { status: 404 });
  }

  const payor = {
    name: company.registeredName || company.tradeName,
    tin: company.tin ?? "",
    address: [company.businessAddress, company.barangay, company.district, company.city, company.province]
      .filter(Boolean)
      .join(", "),
    zip: company.zipCode ?? "",
  };

  const certs: Form2307Data[] = selected.map((p) => ({
    payee: { name: p.name, tin: p.tin, address: p.address, zip: p.zip },
    payor,
    postingDate: from,
    periodFrom: from,
    periodTo: to,
    documentNo: "",
    rows: p.rows.map((r) => ({ atc: r.atc, description: r.description, income: r.income, tax: r.tax, months: r.months })),
  }));

  const pdf = await renderForm2307Pdf(certs);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="BIR-2307_${from}_to_${to}.pdf"`,
    },
  });
}
