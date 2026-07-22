import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getEquityStatement } from "@/lib/reports";
import { resolveBranchScope, branchScopeLabel } from "@/lib/branchScope";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

// Print-preview of the Statement of Changes in Equity.
export default async function EquityStatementPrintPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string; locationId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const dateFrom = searchParams.dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const dateTo = searchParams.dateTo ?? new Date().toISOString().slice(0, 10);
  const branch = await resolveBranchScope(company.id, searchParams.locationId);
  const s = await getEquityStatement(company.id, new Date(dateFrom), new Date(dateTo), branch);

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  let coverage = `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  if (branch) coverage = `${coverage} · Branch: ${await branchScopeLabel(branch)}`;

  const money = (v: number) => (v < 0 ? `(${formatPeso(Math.abs(v))})` : formatPeso(v));
  const num = "py-1 pr-2 text-right font-mono";

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="Statement of Changes in Equity" coverage={coverage} />

      <table className="mt-4 w-full text-sm">
        <tbody>
          <tr className="font-semibold">
            <td className="py-1 pr-2">Equity, beginning of period</td>
            <td className={num}>{formatPeso(s.beginningEquity)}</td>
          </tr>
          <tr className="bg-neutral-50">
            <td className="py-1 pl-4 pr-2">{s.netIncome >= 0 ? "Add: Net income for the period" : "Less: Net loss for the period"}</td>
            <td className={num}>{money(s.netIncome)}</td>
          </tr>
          <tr>
            <td className="py-1 pl-4 pr-2">{s.netContributions >= 0 ? "Add: Additional contributions" : "Less: Owner's drawings"}</td>
            <td className={num}>{money(s.netContributions)}</td>
          </tr>
          <tr className="text-base font-bold">
            <td className="border-t-2 border-neutral-800 py-2 pr-2">Equity, end of period</td>
            <td className="border-t-2 border-neutral-800 py-2 pr-2 text-right font-mono">{formatPeso(s.endingEquity)}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
