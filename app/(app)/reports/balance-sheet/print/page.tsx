import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getBalanceSheet } from "@/lib/reports";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

export default async function BalanceSheetPrintPage({
  searchParams,
}: {
  searchParams: { asOfDate?: string; fiscalYearStart?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const asOfDate = searchParams.asOfDate ?? new Date().toISOString().slice(0, 10);
  const fiscalYearStart = searchParams.fiscalYearStart ?? `${new Date().getFullYear()}-01-01`;
  const s = await getBalanceSheet(company.id, new Date(asOfDate), new Date(fiscalYearStart));

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const num = "py-1 pr-2 text-right font-mono";

  type Line = { accountId: string; code: string; title: string; amount: number };
  const section = (label: string, lines: Line[], totalLabel: string, total: number, extra?: React.ReactNode) => (
    <>
      <tr><td colSpan={2} className="pt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</td></tr>
      {lines.length === 0 ? (
        <tr><td colSpan={2} className="py-1 pl-4 text-neutral-400">None</td></tr>
      ) : (
        lines.map((l, i) => (
          <tr key={l.accountId} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
            <td className="py-1 pl-4 pr-2"><span className="font-mono text-neutral-400">{l.code}</span> {l.title}</td>
            <td className={num}>{formatPeso(l.amount)}</td>
          </tr>
        ))
      )}
      {extra}
      <tr className="font-semibold">
        <td className="border-t border-neutral-300 py-1 pr-2">{totalLabel}</td>
        <td className={`border-t border-neutral-300 ${num}`}>{formatPeso(total)}</td>
      </tr>
    </>
  );

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="Balance Sheet" coverage={`As of ${fmtDate(asOfDate)}`} />

      <table className="mt-4 w-full text-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <tbody>
          {section("Assets", s.assets, "Total assets", s.totalAssets)}
          {section("Liabilities", s.liabilities, "Total liabilities", s.totalLiabilities)}
          {section(
            "Equity",
            s.equity,
            "Total equity",
            s.totalEquityAndEarnings,
            <>
              <tr><td className="py-1 pl-4 pr-2">Current period earnings</td><td className={num}>{formatPeso(s.currentPeriodEarnings)}</td></tr>
              {Math.abs(s.priorUnclosedEarnings) > 0.005 && (
                <tr><td className="py-1 pl-4 pr-2 text-amber-700">Prior years&apos; unclosed earnings</td><td className={`${num} text-amber-700`}>{formatPeso(s.priorUnclosedEarnings)}</td></tr>
              )}
            </>
          )}
          <tr className="text-base font-bold">
            <td className="border-t-2 border-neutral-800 py-2 pr-2">Total liabilities and equity</td>
            <td className="border-t-2 border-neutral-800 py-2 pr-2 text-right font-mono">{formatPeso(s.totalLiabilitiesAndEquity)}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
