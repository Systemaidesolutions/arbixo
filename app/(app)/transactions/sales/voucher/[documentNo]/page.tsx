import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";

// Generic printable voucher for a posted Sales on Account document. Open with
// ?_embed=1 so the app chrome is hidden (see AppShell). Temporary generic
// journal-voucher format — refine per the client's letterhead later.
export default async function SalesVoucherPage({ params }: { params: { documentNo: string } }) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const documentNo = decodeURIComponent(params.documentNo);
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id, journalType: "SALES_ON_ACCOUNT", documentNo },
    include: { account: true, customer: true },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) notFound();

  const first = entries[0];
  const cust = first.customer;
  const customerName = cust?.registeredName || cust?.tradeName || [cust?.lastName, cust?.firstName].filter(Boolean).join(", ") || "—";
  const totalDebit = entries.reduce((s, e) => s + Number(e.debitAmount), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.creditAmount), 0);
  const companyName = company.registeredName || company.tradeName;
  const address = [company.businessAddress, company.barangay, company.city, company.province, company.zipCode].filter(Boolean).join(", ");
  const isCM = first.documentType === "CREDIT_MEMO";

  const sig = (role: string) => (
    <div className="text-center text-[11px]">
      <div className="mx-auto mt-8 border-t border-neutral-500 pt-1" style={{ width: "80%" }}>{role}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-neutral-900 sm:p-10 print:p-0">
      <PrintControls />

      <div className="border border-neutral-400 p-6">
        {/* Company header */}
        <div className="text-center">
          <div className="text-lg font-semibold uppercase">{companyName}</div>
          {address && <div className="text-[11px] text-neutral-600">{address}</div>}
          {company.tin && <div className="text-[11px] text-neutral-600">TIN: {company.tin}</div>}
        </div>

        <div className="my-4 border-y border-neutral-400 py-1 text-center text-sm font-semibold tracking-wide">
          {isCM ? "SALES CREDIT MEMO" : "SALES ON ACCOUNT"} — JOURNAL VOUCHER
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div><span className="text-neutral-500">{isCM ? "CM No." : "Invoice No."}:</span> <span className="font-mono font-medium">{documentNo}</span></div>
          <div className="text-right"><span className="text-neutral-500">Date:</span> {new Date(first.postingDate).toLocaleDateString()}</div>
          <div><span className="text-neutral-500">Customer:</span> {customerName}</div>
          <div className="text-right"><span className="text-neutral-500">Customer TIN:</span> {cust?.tin ?? "—"}</div>
        </div>

        {/* Entries */}
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-neutral-400 text-left">
              <th className="py-1 pr-2">Account Code</th>
              <th className="py-1 pr-2">Account Title / Particulars</th>
              <th className="py-1 pr-2 text-right">Debit</th>
              <th className="py-1 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-neutral-200 align-top">
                <td className="py-1 pr-2 font-mono">{e.account.code}</td>
                <td className="py-1 pr-2">
                  {e.account.title}
                  {e.description && <span className="block text-[10px] text-neutral-500">{e.description}</span>}
                </td>
                <td className="py-1 pr-2 text-right font-mono">{Number(e.debitAmount) ? formatPeso(Number(e.debitAmount)) : ""}</td>
                <td className="py-1 text-right font-mono">{Number(e.creditAmount) ? formatPeso(Number(e.creditAmount)) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-400 font-semibold">
              <td className="py-1 pr-2" colSpan={2}>TOTAL</td>
              <td className="py-1 pr-2 text-right font-mono">{formatPeso(totalDebit)}</td>
              <td className="py-1 text-right font-mono">{formatPeso(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>

        {first.description && <div className="mt-3 text-xs"><span className="text-neutral-500">Particulars:</span> {first.description}</div>}

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-3 gap-6">
          {sig("Prepared by")}
          {sig("Approved by")}
          {sig("Received by")}
        </div>
      </div>
    </div>
  );
}
