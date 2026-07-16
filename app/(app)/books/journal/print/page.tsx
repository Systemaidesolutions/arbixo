import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getJournalBook, JOURNAL_BOOKS } from "@/lib/booksOfAccounts";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

const BOOK_META: Record<string, { title: string; partyLabel: string }> = {
  "cash-receipts": { title: "Cash Receipts Journal", partyLabel: "Received from" },
  "cash-disbursement": { title: "Cash Disbursement Journal", partyLabel: "Paid to" },
  "general-journal": { title: "General Journal", partyLabel: "Party" },
  sales: { title: "Sales Subsidiary Journal", partyLabel: "Customer" },
  purchases: { title: "Purchase Subsidiary Journal", partyLabel: "Vendor" },
};

export default async function JournalBookPrintPage({
  searchParams,
}: {
  searchParams: { book?: string; from?: string; to?: string };
}) {
  const company = await requirePostingCompany();
  const book = searchParams.book ?? "";
  const cfg = JOURNAL_BOOKS[book];
  const meta = BOOK_META[book];
  if (!company || !cfg || !meta) notFound();

  const from = searchParams.from ?? `${new Date().getFullYear()}-01-01`;
  const to = searchParams.to ?? new Date().toISOString().slice(0, 10);
  const data = await getJournalBook(company.id, cfg.journalTypes, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`));

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = `For the period ${fmtDate(from)} to ${fmtDate(to)}`;
  const num = "px-1 py-1 text-right font-mono";

  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title={meta.title} coverage={coverage} />

      <table className="mt-4 w-full text-xs" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr className="border-b border-neutral-400 text-left uppercase tracking-wide text-neutral-600">
            <th className="px-1 py-1">Date</th>
            <th className="px-1 py-1">Doc No.</th>
            <th className="px-1 py-1">Account</th>
            <th className="px-1 py-1">{meta.partyLabel}</th>
            <th className="px-1 py-1 text-right">Debit</th>
            <th className="px-1 py-1 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 ? (
            <tr><td colSpan={6} className="py-4 text-center text-neutral-400">No entries in this period</td></tr>
          ) : (
            data.lines.map((l, i) => (
              <tr key={l.id} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                <td className="whitespace-nowrap px-1 py-1">{new Date(l.postingDate).toISOString().slice(0, 10)}</td>
                <td className="px-1 py-1 font-mono">{l.documentNo}</td>
                <td className="px-1 py-1"><span className="font-mono text-neutral-400">{l.accountCode}</span> {l.accountTitle}</td>
                <td className="px-1 py-1 text-neutral-600">{l.counterparty ?? "—"}</td>
                <td className={num}>{l.debit ? formatPeso(l.debit) : ""}</td>
                <td className={num}>{l.credit ? formatPeso(l.credit) : ""}</td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-neutral-800 font-bold">
            <td colSpan={4} className="px-1 py-1">TOTAL</td>
            <td className={num}>{formatPeso(data.totalDebit)}</td>
            <td className={num}>{formatPeso(data.totalCredit)}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
