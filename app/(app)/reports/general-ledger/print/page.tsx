import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getGeneralLedger } from "@/lib/reports";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

const bal = (n: number) => `${formatPeso(Math.abs(n))} ${n >= 0 ? "Dr" : "Cr"}`;

export default async function GeneralLedgerPrintPage({
  searchParams,
}: {
  searchParams: { accountId?: string; dateFrom?: string; dateTo?: string };
}) {
  const company = await requirePostingCompany();
  if (!company || !searchParams.accountId) notFound();

  const dateFrom = searchParams.dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const dateTo = searchParams.dateTo ?? new Date().toISOString().slice(0, 10);
  const g = await getGeneralLedger(company.id, searchParams.accountId, new Date(dateFrom), new Date(dateTo));

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = `${g.account.code} — ${g.account.title}  ·  ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  const num = "px-1 py-1 text-right font-mono";

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="General Ledger" coverage={coverage} />

      <table className="mt-4 w-full text-xs" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr className="border-b border-neutral-400 text-left uppercase tracking-wide text-neutral-600">
            <th className="px-1 py-1">Date</th>
            <th className="px-1 py-1">Journal</th>
            <th className="px-1 py-1">Doc no.</th>
            <th className="px-1 py-1 text-right">Debit</th>
            <th className="px-1 py-1 text-right">Credit</th>
            <th className="px-1 py-1 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-semibold">
            <td colSpan={5} className="px-1 py-1">Beginning balance</td>
            <td className={num}>{bal(g.beginningBalance)}</td>
          </tr>
          {g.rows.length === 0 ? (
            <tr><td colSpan={6} className="py-4 text-center text-neutral-400">No entries for this period</td></tr>
          ) : (
            g.rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                <td className="whitespace-nowrap px-1 py-1">{new Date(r.postingDate).toISOString().slice(0, 10)}</td>
                <td className="px-1 py-1 text-neutral-500">{r.journalType.replaceAll("_", " ")}</td>
                <td className="px-1 py-1 font-mono">{r.documentNo}</td>
                <td className={num}>{r.debit > 0 ? formatPeso(r.debit) : ""}</td>
                <td className={num}>{r.credit > 0 ? formatPeso(r.credit) : ""}</td>
                <td className={num}>{bal(r.runningBalance)}</td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-neutral-800 font-bold">
            <td colSpan={5} className="px-1 py-1">Ending balance</td>
            <td className={num}>{bal(g.endingBalance)}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
