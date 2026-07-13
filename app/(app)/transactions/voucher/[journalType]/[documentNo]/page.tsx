import { notFound } from "next/navigation";
import { requirePostingCompany, getCurrentUserRecord } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { pesosInWords } from "@/lib/amountInWords";
import { PrintControls } from "@/components/PrintControls";
import type { JournalType } from "@prisma/client";

// Printable voucher for any posted transaction, styled after the client's Check
// Voucher. Open with ?_embed=1 so the app chrome is hidden (see AppShell).
const META: Record<JournalType, { title: string; partyLabel: string }> = {
  CASH_RECEIPT: { title: "Cash Receipt Voucher", partyLabel: "Payor" },
  CASH_DISBURSEMENT: { title: "Check Voucher", partyLabel: "Payee" },
  SALES_ON_ACCOUNT: { title: "Sales Voucher", partyLabel: "Customer" },
  PURCHASE_ON_ACCOUNT: { title: "Purchase Voucher", partyLabel: "Supplier" },
  GENERAL_JOURNAL: { title: "Journal Voucher", partyLabel: "Party" },
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

  const withParty = entries.find((e) => e.customer || e.vendor || e.employee || e.contact);
  const p = withParty?.customer || withParty?.vendor || withParty?.contact;
  const partyName =
    p?.registeredName || p?.tradeName ||
    (withParty?.employee ? `${withParty.employee.firstName} ${withParty.employee.lastName}` : null) ||
    [p?.lastName, p?.firstName].filter(Boolean).join(", ") || "";
  const partyAddress = p?.address ?? "";
  const partyTin = withParty?.customer?.tin ?? withParty?.vendor?.tin ?? withParty?.contact?.tin ?? "";
  const checkNo = entries.find((e) => e.checkNo)?.checkNo ?? "";

  // Preparer + approver.
  const me = await getCurrentUserRecord();
  const preparedBy = me?.name || me?.email || "";
  const approvedBy = company.authorizedRep ?? "";
  const approvedTitle = company.authorizedRepPosition ?? "";

  // The document Particulars is the same on every line — show it once.
  const docParticulars = entries.find((e) => e.description)?.description ?? "";
  // Line items below it come from the main (income/expense) lines, labelled
  // by their per-line Description; fall back to debit lines / the account title.
  let particulars = entries
    .filter((e) => Number(e.netAmount ?? 0) > 0)
    .map((e) => ({ name: e.lineDescription || e.account.title, amount: Number(e.netAmount) + Number(e.vatAmount ?? 0) }));
  if (particulars.length === 0) {
    particulars = entries.filter((e) => Number(e.debitAmount) > 0).map((e) => ({ name: e.lineDescription || e.account.title, amount: Number(e.debitAmount) }));
  }
  const particularsTotal = particulars.reduce((s, r) => s + r.amount, 0);
  const totalDebit = entries.reduce((s, e) => s + Number(e.debitAmount), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.creditAmount), 0);

  const companyName = company.registeredName || company.tradeName;
  const addrLine1 = company.businessAddress ?? "";
  const addrLine2 = [company.barangay, company.city, company.province, company.zipCode].filter(Boolean).join(", ");

  const b = "border border-neutral-800";
  const padRows = Math.max(0, 4 - particulars.length);
  const distPad = Math.max(0, 8 - entries.length);

  return (
    <div className="mx-auto max-w-[760px] bg-white p-6 text-neutral-900 print:p-0">
      <PrintControls />

      {/* Letterhead */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="h-16 w-auto max-w-[120px] object-contain" />
          )}
          <div className="leading-tight">
            <div className="text-sm font-bold uppercase">{companyName}</div>
            {addrLine1 && <div className="text-[10px]">{addrLine1}</div>}
            {addrLine2 && <div className="text-[10px]">{addrLine2}</div>}
            {company.tin && <div className="text-[10px]">TIN: {company.tin}</div>}
            {company.website && <div className="text-[10px] text-blue-700">Website: {company.website}</div>}
            {(company.email || company.telNo || company.faxNo) && <div className="text-[10px] text-blue-700">Contact: {[company.email, company.telNo, company.faxNo].filter(Boolean).join(" | ")}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-red-600">{meta.title}</div>
          <div className="mt-1 text-sm font-semibold text-red-600">
            NO. <span className="ml-1 font-mono text-neutral-900">{documentNo}</span>
          </div>
        </div>
      </div>

      {/* Payee / Date / Address / TIN */}
      <table className={`mt-4 w-full ${b} text-xs`}>
        <tbody>
          <tr>
            <td className={`w-2/3 border-b border-r border-neutral-800 px-2 py-1`}><span className="font-semibold">{meta.partyLabel}</span> &nbsp;: {partyName}</td>
            <td className={`border-b border-neutral-800 px-2 py-1`}><span className="font-semibold">Date:</span> {new Date(entries[0].postingDate).toLocaleDateString()}</td>
          </tr>
          <tr><td colSpan={2} className={`border-b border-neutral-800 px-2 py-1`}><span className="font-semibold">Address</span> : {partyAddress}</td></tr>
          <tr><td colSpan={2} className={`px-2 py-1`}><span className="font-semibold">TIN</span> &nbsp;&nbsp;&nbsp;&nbsp;: {partyTin}</td></tr>
        </tbody>
      </table>

      {/* Particulars / Amount */}
      <table className={`mt-3 w-full ${b} text-xs`}>
        <thead>
          <tr>
            <th className={`w-2/3 border-b border-r border-neutral-800 py-1 text-center`}>PARTICULARS</th>
            <th className={`border-b border-neutral-800 py-1 text-center`}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {docParticulars && (
            <tr>
              <td colSpan={2} className={`border-b border-neutral-800 px-2 py-1 font-semibold`}>{docParticulars}</td>
            </tr>
          )}
          {particulars.map((r, i) => (
            <tr key={i}>
              <td className={`border-r border-neutral-800 px-2 py-1 pl-4`}>{r.name}</td>
              <td className={`px-2 py-1 text-right font-mono`}>{formatPeso(r.amount)}</td>
            </tr>
          ))}
          {Array.from({ length: padRows }).map((_, i) => (
            <tr key={`p${i}`}><td className="border-r border-neutral-800 px-2 py-2">&nbsp;</td><td className="px-2 py-2">&nbsp;</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={`border-t border-r border-neutral-800 px-2 py-1 text-right font-semibold`}>Total :</td>
            <td className={`border-t border-neutral-800 px-2 py-1 text-right font-mono font-semibold`}>{formatPeso(particularsTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Distribution + right box */}
      <div className="mt-3 flex gap-3">
        <div className="w-3/5">
          <div className="text-[10px] text-neutral-600">Distribution of Account</div>
          <table className={`mt-1 w-full ${b} text-xs`}>
            <thead>
              <tr>
                <th className={`border-b border-r border-neutral-800 py-1 text-center`}>Account Title</th>
                <th className={`w-20 border-b border-r border-neutral-800 py-1 text-center`}>Debit</th>
                <th className={`w-20 border-b border-neutral-800 py-1 text-center`}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className={`border-r border-neutral-800 px-2 py-0.5`}>{e.account.title}</td>
                  <td className={`border-r border-neutral-800 px-2 py-0.5 text-right font-mono`}>{Number(e.debitAmount) ? formatPeso(Number(e.debitAmount)) : "-"}</td>
                  <td className={`px-2 py-0.5 text-right font-mono`}>{Number(e.creditAmount) ? formatPeso(Number(e.creditAmount)) : "-"}</td>
                </tr>
              ))}
              {Array.from({ length: distPad }).map((_, i) => (
                <tr key={`d${i}`}><td className="border-r border-neutral-800 px-2 py-1">&nbsp;</td><td className="border-r border-neutral-800">&nbsp;</td><td>&nbsp;</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className={`border-t border-r border-neutral-800 px-2 py-1 text-center`}>Total:</td>
                <td className={`border-t border-r border-neutral-800 px-2 py-1 text-right font-mono`}>{formatPeso(totalDebit)}</td>
                <td className={`border-t border-neutral-800 px-2 py-1 text-right font-mono`}>{formatPeso(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={`flex w-2/5 flex-col ${b} p-2 text-xs`}>
          <div><span className="font-semibold">Pesos</span> : {pesosInWords(particularsTotal)}</div>
          <div className="mt-4 border-t border-neutral-300 pt-1">
            <span className="font-semibold">Bank</span> : {journalType === "CASH_DISBURSEMENT" ? "" : "—"}
            <span className="ml-3 font-semibold">Check No:</span> {checkNo || "—"}
          </div>
          <div className="mt-2 font-semibold">Received Payment by</div>
          <div className="mt-auto pt-8 text-center text-[10px] text-neutral-500">_______________________</div>
        </div>
      </div>

      {/* Signatures */}
      <table className={`mt-3 w-full ${b} text-xs`}>
        <tbody>
          <tr className="align-top">
            <td className={`w-1/3 border-r border-neutral-800 p-2`}>
              Prepared by:
              <div className="mt-6 text-center text-[11px] font-semibold">{preparedBy}</div>
            </td>
            <td className={`w-1/3 border-r border-neutral-800 p-2`}>
              Certified Correct By:
              <div className="mt-6">&nbsp;</div>
            </td>
            <td className={`w-1/3 p-2`}>
              Approved By:
              <div className="mt-6 text-center text-[11px] font-semibold">{approvedBy}</div>
              {approvedTitle && <div className="text-center text-[10px] text-neutral-500">{approvedTitle}</div>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
