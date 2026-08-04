import { NextRequest, NextResponse } from "next/server";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { renderForm2307Pdf, type Row2307 } from "@/lib/form2307Pdf";
import type { JournalType } from "@prisma/client";

// BIR 2307 for a POSTED document (Purchase on Account / Cash Disbursement),
// stamped onto BIR's own blank form. The company is the PAYOR / withholding
// agent; the counterparty is the PAYEE whose income had tax withheld.
export async function GET(request: NextRequest) {
  const company = await requirePostingCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const journalType = sp.get("journalType") as JournalType | null;
  const documentNo = sp.get("documentNo");
  if (!journalType || !documentNo) {
    return NextResponse.json({ error: "journalType and documentNo are required" }, { status: 400 });
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id, journalType, documentNo },
    include: { customer: true, vendor: true, employee: true, contact: true },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const withParty = entries.find((e) => e.customer || e.vendor || e.employee || e.contact);
  const cp = withParty?.vendor || withParty?.customer || withParty?.contact;
  const payeeName =
    cp?.registeredName || cp?.tradeName ||
    (withParty?.employee ? [withParty.employee.firstName, withParty.employee.middleName, withParty.employee.lastName].filter(Boolean).join(" ") : null) ||
    [cp?.lastName, cp?.firstName].filter(Boolean).join(", ") || "";
  const payeeTin = withParty?.vendor?.tin ?? withParty?.customer?.tin ?? withParty?.contact?.tin ?? "";

  const payeeParty = cp ?? withParty?.employee ?? null;
  const payeeAddr = payeeParty
    ? [payeeParty.address, payeeParty.barangay, payeeParty.district, payeeParty.city, payeeParty.province].filter(Boolean).join(", ")
    : "";

  const payorAddr = [company.businessAddress, company.barangay, company.district, company.city, company.province]
    .filter(Boolean)
    .join(", ");

  const rowsByAtc = new Map<string, Row2307>();
  for (const e of entries) {
    const tax = Number(e.withholdingAmt ?? 0);
    if (tax <= 0) continue;
    const key = e.atcCode ?? "—";
    const income = Number(e.netAmount ?? 0);
    const existing = rowsByAtc.get(key);
    if (existing) {
      existing.income += income;
      existing.tax += tax;
    } else {
      rowsByAtc.set(key, { atc: e.atcCode ?? "", description: e.atcDescription ?? e.description ?? "", income, tax });
    }
  }

  const pdf = await renderForm2307Pdf([
    {
      payee: { name: payeeName, tin: payeeTin, address: payeeAddr, zip: payeeParty?.zipCode ?? "" },
      payor: { name: company.registeredName || company.tradeName, tin: company.tin ?? "", address: payorAddr, zip: company.zipCode ?? "" },
      postingDate: new Date(entries[0].postingDate).toISOString().slice(0, 10),
      documentNo,
      rows: [...rowsByAtc.values()],
    },
  ]);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="BIR-2307_${documentNo}.pdf"`,
    },
  });
}
