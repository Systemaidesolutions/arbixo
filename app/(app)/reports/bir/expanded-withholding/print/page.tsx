import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { getExpandedWithholding } from "@/lib/ewt";
import { resolveBranchScope, branchScopeLabel } from "@/lib/branchScope";
import { computeEwt1601, emptyEwt1601Manual, EWT_1601_LABELS, type Ewt1601Manual } from "@/lib/ewt1601eq";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

function parseManual(raw?: string): Ewt1601Manual {
  const base = emptyEwt1601Manual();
  if (!raw) return base;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const k of Object.keys(base) as (keyof Ewt1601Manual)[]) {
      const v = Number(obj[k]);
      if (Number.isFinite(v)) base[k] = v;
    }
  } catch {
    // ignore malformed adj param
  }
  return base;
}

// Print-preview of the Expanded Withholding Tax return (BIR 1601-EQ, Part II).
export default async function ExpandedWithholdingPrintPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string; label?: string; adj?: string; locationId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const now = new Date();
  const dateFrom = searchParams.dateFrom ?? `${now.getFullYear()}-01-01`;
  const dateTo = searchParams.dateTo ?? now.toISOString().slice(0, 10);
  const manual = parseManual(searchParams.adj);

  const branch = await resolveBranchScope(company.id, searchParams.locationId);
  const data = await getExpandedWithholding(company.id, new Date(`${dateFrom}T00:00:00`), new Date(`${dateTo}T23:59:59.999`), branch);
  const T = computeEwt1601(data.totalWithheld, manual);

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  let coverage = searchParams.label ? `For ${searchParams.label}` : `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  if (branch) coverage = `${coverage} · Branch: ${await branchScopeLabel(branch)}`;

  const td = "border-b border-neutral-200 px-2 py-1 align-top";
  const num = `${td} text-right font-mono whitespace-nowrap`;
  const money = (v: number) => formatPeso(v);
  const line = (n: string, a: number, bold = false) => (
    <tr className={bold ? "font-semibold" : ""}>
      <td className={`${td} w-8 text-neutral-500`}>{n}</td>
      <td className={td}>{EWT_1601_LABELS[n]}</td>
      <td className={num}>{money(a)}</td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="Expanded Withholding Tax" coverage={coverage} />

      {/* ATC breakdown — items 13-18 */}
      <table className="mt-4 w-full text-xs" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr className="border-b border-neutral-400 text-left uppercase tracking-wide text-neutral-600">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">ATC</th>
            <th className="px-2 py-1 text-right">Tax Base</th>
            <th className="px-2 py-1 text-right">Rate (%)</th>
            <th className="px-2 py-1 text-right">Tax Withheld</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr><td colSpan={5} className="py-3 text-center text-neutral-400">No withholding for this period</td></tr>
          ) : (
            data.rows.map((r, i) => (
              <tr key={r.atcCode} className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                <td className={`${td} text-neutral-500`}>{13 + i}</td>
                <td className={td}><span className="font-mono">{r.atcCode}</span>{r.atcDescription ? ` — ${r.atcDescription}` : ""}</td>
                <td className={num}>{money(r.taxBase)}</td>
                <td className={num}>{r.ratePercent.toFixed(2)}</td>
                <td className={num}>{money(r.taxWithheld)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Computation — items 19-30 */}
      <table className="mt-4 w-full text-xs" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <tbody>
          {line("19", T.l19, true)}
          {line("20", manual.l20)}
          {line("21", manual.l21)}
          {line("22", manual.l22)}
          {line("23", manual.l23)}
          {line("24", T.l24, true)}
          {line("25", T.l25, true)}
          {line("26", manual.l26)}
          {line("27", manual.l27)}
          {line("28", manual.l28)}
          {line("29", T.l29, true)}
          <tr className="text-sm font-bold">
            <td className="border-t-2 border-neutral-800 px-2 py-2" colSpan={2}>{EWT_1601_LABELS["30"]}</td>
            <td className="border-t-2 border-neutral-800 px-2 py-2 text-right font-mono">{formatPeso(T.l30)}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
