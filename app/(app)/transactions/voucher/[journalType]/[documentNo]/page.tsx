import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import type { JournalType } from "@prisma/client";

// Generic printable journal voucher for any posted transaction. Open with
// ?_embed=1 so the app chrome is hidden (see AppShell). Temporary generic
// format — refine to the client's letterhead later.
const META: Record<JournalType, { title: string; refLabel: string; partyLabel: string | null; hasCheck: boolean }> = {
  CASH_RECEIPT: { title: "Cash Receipt Voucher", refLabel: "OR No.", partyLabel: "Payor", hasCheck: false },
  CASH_DISBURSEMENT: { title: "Cash Disbursement Voucher", refLabel: "CV No.", partyLabel: "Payee", hasCheck: true },
  SALES_ON_ACCOUNT: { title: "Sales on Account — Journal Voucher", refLabel: "Invoice No.", partyLabel: "Customer", hasCheck: false },
  PURCHASE_ON_ACCOUNT: { title: "Purchase on Account — Journal Voucher", refLabel: "PV No.", partyLabel: "Supplier", hasCheck: false },
  GENERAL_JOURNAL: { title: "General Journal — Journal Voucher", refLabel: "JV No.", partyLabel: null, hasCheck: false },
};

export default async function VoucherPage({ params }: { params: { journalType: string; documentNo: string } }) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const journalType = params.journalType as JournalType;
  const meta = META[journalType];
  if (!meta) notFound();

  const documentNo = decodeURIComponent(params.documentNo);
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id, journalType, documentNo },
    include: { account: true, customer: true, vendor: true, employee: true, contact: true },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) notFound();

  const first = entries.find((e) => e.customer || e.vendor || e.employee || e.contact) ?? entries[0];
  const c = first.customer || first.vendor || first.contact;
  const partyName =
    c?.registeredName || c?.tradeName || (first.employee ? `${first.employee.firstName} ${first.employee.lastName}` : null) ||
    [c?.lastName, c?.firstName].filter(Boolean).join(", ") || "—";
  const partyTin = first.customer?.tin ?? first.vendor?.tin ?? first.contact?.tin ?? null;
  const checkNo = entries.find((e) => e.checkNo)?.checkNo ?? null;

  const totalDebit = entries.reduce((s, e) => s + Number(e.debitAmount), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.creditAmount), 0);
  const companyName = company.registeredName || company.tradeName;
  const address = [company.businessAddress, company.barangay, company.city, company.province, company.zipCode].filter(Boolean).join(", ");
  const isCM = entries[0].documentType === "CREDIT_MEMO";

  const sig = (role: string) => (
    <div className="text-center text-[11px]">
      <div className="mx-auto mt-8 border-t border-neutral-500 pt-1" style={{ width: "80%" }}>{role}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-neutral-900 sm:p-10 print:p-0">
      <PrintControls />

      <div className="border border-neutral-400 p-6">
        <div className="text-center">
          <div className="text-lg font-semibold uppercase">{companyName}</div>
          {address && <div className="text-[11px] text-neutral-600">{address}</div>}
          {company.tin && <div className="text-[11px] text-neutral-600">TIN: {company.tin}</div>}
        </div>

        <div className="my-4 border-y border-neutral-400 py-1 text-center text-sm font-semibold tracking-wide">
          {isCM ? "CREDIT MEMO — " : ""}{meta.title}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div><span className="text-neutral-500">{meta.refLabel}:</span> <span className="font-mono font-medium">{documentNo}</span></div>
          <div className="text-right"><span className="text-neutral-500">Date:</span> {new Date(entries[0].postingDate).toLocaleDateString()}</div>
          {meta.partyLabel && <div><span className="text-neutral-500">{meta.partyLabel}:</span> {partyName}</div>}
          {meta.partyLabel && <div className="text-right"><span className="text-neutral-500">TIN:</span> {partyTin ?? "—"}</div>}
          {meta.hasCheck && checkNo && <div><span className="text-neutral-500">Check No.:</span> {checkNo}</div>}
        </div>

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

        <div className="mt-10 grid grid-cols-3 gap-6">
          {sig("Prepared by")}
          {sig("Approved by")}
          {sig("Received by")}
        </div>
      </div>
    </div>
  );
}
