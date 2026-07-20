import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getCashFlowStatement } from "@/lib/reports";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";
import type { CashFlowLine } from "@/lib/reports";

const php = (n: number) => `${n < 0 ? "-" : ""}PHP ${formatPeso(Math.abs(n))}`;

export default async function CashFlowStatementPrintPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const dateFrom = searchParams.dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const dateTo = searchParams.dateTo ?? new Date().toISOString().slice(0, 10);
  const data = await getCashFlowStatement(company.id, new Date(dateFrom), new Date(dateTo));

  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = `For the period ${fmt(dateFrom)} to ${fmt(dateTo)}`;

  const num = "py-1 pr-2 text-right font-mono whitespace-nowrap";
  const money = (v: number) => php(v);
  const lines = (ls: CashFlowLine[]) =>
    ls.map((l, i) => (
      <tr key={i}>
        <td className="py-1 pl-8 pr-2"><span className="font-mono text-neutral-400">{l.code ? `${l.code} ` : ""}</span>{l.title}</td>
        <td className={num}>{money(l.amount)}</td>
      </tr>
    ));

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="Statement of Cash Flows" coverage={coverage} />

      <table className="mt-4 w-full text-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <tbody>
          <tr><td colSpan={2} className="pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Cash flows from operating activities</td></tr>
          <tr><td className="py-1 pl-4 pr-2">Profit for the year</td><td className={num}>{money(data.netIncome)}</td></tr>
          <tr><td className="py-1 pl-4 pr-2">Adjustments for non-cash income and expenses</td><td className={num}>{money(data.operatingAdjustmentsTotal)}</td></tr>
          {lines(data.operatingAdjustments)}
          <tr className="font-semibold"><td className="border-t border-neutral-300 py-1 pl-4 pr-2">Net cash from operating activities</td><td className={`border-t border-neutral-300 ${num}`}>{money(data.netOperating)}</td></tr>

          {data.investing.length > 0 && (
            <>
              <tr><td colSpan={2} className="pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Cash flows from investing activities</td></tr>
              {lines(data.investing)}
              <tr className="font-semibold"><td className="border-t border-neutral-300 py-1 pl-4 pr-2">Net cash from investing activities</td><td className={`border-t border-neutral-300 ${num}`}>{money(data.netInvesting)}</td></tr>
            </>
          )}

          {data.financing.length > 0 && (
            <>
              <tr><td colSpan={2} className="pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Cash flows from financing activities</td></tr>
              {lines(data.financing)}
              <tr className="font-semibold"><td className="border-t border-neutral-300 py-1 pl-4 pr-2">{data.netFinancing < 0 ? "Net cash used in financing activities" : "Net cash from financing activities"}</td><td className={`border-t border-neutral-300 ${num}`}>{money(data.netFinancing)}</td></tr>
            </>
          )}

          <tr className="font-semibold"><td className="border-t-2 border-neutral-800 py-1 pr-2">NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS</td><td className={`border-t-2 border-neutral-800 ${num}`}>{money(data.netChange)}</td></tr>
          <tr><td className="py-1 pr-2">Cash and cash equivalents at beginning of year</td><td className={num}>{money(data.beginningCash)}</td></tr>
          <tr className="text-base font-bold"><td className="border-t border-neutral-400 py-2 pr-2">CASH AND CASH EQUIVALENTS AT END OF YEAR</td><td className={`border-t border-neutral-400 py-2 pr-2 text-right font-mono`}>{money(data.endingCash)}</td></tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
