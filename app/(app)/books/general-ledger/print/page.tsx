import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getGeneralLedgerBook } from "@/lib/booksOfAccounts";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";
import type { JournalType } from "@prisma/client";

const JRNL: Record<JournalType, string> = { CASH_DISBURSEMENT: "CDJ", CASH_RECEIPT: "CRJ", SALES_ON_ACCOUNT: "SJ", PURCHASE_ON_ACCOUNT: "PJ", GENERAL_JOURNAL: "GJ" };
const bal = (n: number) => `${formatPeso(Math.abs(n))} ${n < 0 ? "Cr" : "Dr"}`;

export default async function GeneralLedgerBookPrintPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const from = searchParams.from ?? `${new Date().getFullYear()}-01-01`;
  const to = searchParams.to ?? new Date().toISOString().slice(0, 10);
  const data = await getGeneralLedgerBook(company.id, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`));

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = `For the period ${fmtDate(from)} to ${fmtDate(to)}`;
  const num = "px-1 py-[3px] text-right font-mono";

  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="General Ledger" coverage={coverage} />

      {data.accounts.length === 0 ? (
        <p className="mt-6 text-center text-sm text-neutral-400">No account activity in this period</p>
      ) : (
        <div className="mt-4 space-y-4" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
          {data.accounts.map((acc) => (
            <div key={acc.code} className="break-inside-avoid">
              <div className="flex items-center justify-between border-b border-neutral-400 pb-1">
                <div className="text-sm font-semibold"><span className="font-mono text-neutral-500">{acc.code}</span> {acc.title}</div>
                <div className="text-xs text-neutral-600">Beginning: <span className="font-mono">{bal(acc.beginningBalance)}</span></div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-neutral-500">
                    <th className="px-1 py-[3px]">Date</th>
                    <th className="px-1 py-[3px]">Doc No.</th>
                    <th className="px-1 py-[3px]">Jrnl</th>
                    <th className="px-1 py-[3px]">Particulars</th>
                    <th className="px-1 py-[3px] text-right">Debit</th>
                    <th className="px-1 py-[3px] text-right">Credit</th>
                    <th className="px-1 py-[3px] text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {acc.entries.map((e, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                      <td className="whitespace-nowrap px-1 py-[3px]">{new Date(e.postingDate).toISOString().slice(0, 10)}</td>
                      <td className="px-1 py-[3px] font-mono">{e.documentNo}</td>
                      <td className="px-1 py-[3px] text-neutral-500">{JRNL[e.journalType]}</td>
                      <td className="max-w-[200px] truncate px-1 py-[3px] text-neutral-600">{e.particulars ?? e.counterparty ?? "—"}</td>
                      <td className={num}>{e.debit ? formatPeso(e.debit) : ""}</td>
                      <td className={num}>{e.credit ? formatPeso(e.credit) : ""}</td>
                      <td className={num}>{bal(e.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-neutral-400 font-semibold">
                    <td colSpan={4} className="px-1 py-[3px]">Total — ending {bal(acc.endingBalance)}</td>
                    <td className={num}>{formatPeso(acc.totalDebit)}</td>
                    <td className={num}>{formatPeso(acc.totalCredit)}</td>
                    <td className="px-1 py-[3px]" />
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
          <div className="flex justify-between border-t-2 border-neutral-800 pt-1 text-sm font-bold">
            <span>Grand total (period movement)</span>
            <span className="font-mono">Dr {formatPeso(data.totalDebit)} · Cr {formatPeso(data.totalCredit)}</span>
          </div>
        </div>
      )}

      <ReportFooter />
    </main>
  );
}
