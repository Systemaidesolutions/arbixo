import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getIncomeStatement } from "@/lib/reports";
import { resolveBranchScope, branchScopeLabel } from "@/lib/branchScope";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

// Print-preview of the Income Statement (standard multi-step format).
export default async function IncomeStatementPrintPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string; locationId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const dateFrom = searchParams.dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const dateTo = searchParams.dateTo ?? new Date().toISOString().slice(0, 10);
  const branch = await resolveBranchScope(company.id, searchParams.locationId);
  const s = await getIncomeStatement(company.id, new Date(dateFrom), new Date(dateTo), branch);

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  let coverage = `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  if (branch) coverage = `${coverage} · Branch: ${await branchScopeLabel(branch)}`;

  const num = "py-1 pr-2 text-right font-mono";

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="Income Statement" coverage={coverage} />

      <table className="mt-4 w-full text-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <tbody>
          {/* Revenue */}
          <tr><td colSpan={2} className="pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Revenue</td></tr>
          {s.revenue.length === 0 ? (
            <tr><td colSpan={2} className="py-1 pl-4 text-neutral-400">No revenue this period</td></tr>
          ) : (
            s.revenue.map((l, i) => (
              <tr key={l.accountId} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                <td className="py-1 pl-4 pr-2"><span className="font-mono text-neutral-400">{l.code}</span> {l.title}</td>
                <td className={num}>{formatPeso(l.amount)}</td>
              </tr>
            ))
          )}
          <tr className="font-semibold">
            <td className="border-t border-neutral-300 py-1 pr-2">Total revenue</td>
            <td className={`border-t border-neutral-300 ${num}`}>{formatPeso(s.totalRevenue)}</td>
          </tr>

          {/* Expenses */}
          <tr><td colSpan={2} className="pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Operating expenses</td></tr>
          {s.expense.length === 0 ? (
            <tr><td colSpan={2} className="py-1 pl-4 text-neutral-400">No expenses this period</td></tr>
          ) : (
            s.expense.map((l, i) => (
              <tr key={l.accountId} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                <td className="py-1 pl-4 pr-2"><span className="font-mono text-neutral-400">{l.code}</span> {l.title}</td>
                <td className={num}>{formatPeso(l.amount)}</td>
              </tr>
            ))
          )}
          <tr className="font-semibold">
            <td className="border-t border-neutral-300 py-1 pr-2">Total operating expenses</td>
            <td className={`border-t border-neutral-300 ${num}`}>{formatPeso(s.totalExpense)}</td>
          </tr>

          {/* Net income */}
          <tr className="text-base font-bold">
            <td className="border-t-2 border-neutral-800 py-2 pr-2">{s.netIncome >= 0 ? "Net Income" : "Net Loss"}</td>
            <td className={`border-t-2 border-neutral-800 py-2 pr-2 text-right font-mono`}>{formatPeso(Math.abs(s.netIncome))}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
