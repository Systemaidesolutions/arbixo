import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { Form2307, type Row2307 } from "@/components/Form2307";
import type { JournalType } from "@prisma/client";

// BIR 2307 for a POSTED document. For income journals (Cash Receipt / Sales),
// the company is the payee whose income had tax withheld, and the counterparty
// is the payor / withholding agent (matching how SAWT reads this data).
export default async function Form2307Page({ params }: { params: { journalType: string; documentNo: string } }) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const journalType = params.journalType as JournalType;
  const documentNo = decodeURIComponent(params.documentNo);
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id, journalType, documentNo },
    include: { customer: true, vendor: true, employee: true, contact: true },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) notFound();

  const withParty = entries.find((e) => e.customer || e.vendor || e.employee || e.contact);
  const cp = withParty?.customer || withParty?.vendor || withParty?.contact;
  const payorName =
    cp?.registeredName || cp?.tradeName ||
    (withParty?.employee ? `${withParty.employee.firstName} ${withParty.employee.lastName}` : null) ||
    [cp?.lastName, cp?.firstName].filter(Boolean).join(", ") || "";
  const payorTin = withParty?.customer?.tin ?? withParty?.vendor?.tin ?? withParty?.contact?.tin ?? "";

  const payeeAddr = [company.businessAddress, company.barangay, company.city, company.province, company.zipCode]
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

  return (
    <Form2307
      data={{
        payee: { name: company.registeredName || company.tradeName, tin: company.tin ?? "", address: payeeAddr },
        payor: { name: payorName, tin: payorTin, address: cp?.address ?? "" },
        postingDate: new Date(entries[0].postingDate).toISOString().slice(0, 10),
        documentNo,
        rows: [...rowsByAtc.values()],
      }}
    />
  );
}
