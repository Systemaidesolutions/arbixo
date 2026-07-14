import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requirePostingCompany } from "@/lib/currentUser";
import { getVatReturn } from "@/lib/bir";
import { computeVat2550Q, emptyVat2550QManual, VAT_2550Q_LABELS, VAT_2550Q_SECTIONS, type Vat2550QManual } from "@/lib/vat2550q";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";

function parseManual(raw?: string): Vat2550QManual {
  const base = emptyVat2550QManual();
  if (!raw) return base;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const k of Object.keys(base) as (keyof Vat2550QManual)[]) {
      const v = Number(obj[k]);
      if (Number.isFinite(v)) base[k] = v;
    }
  } catch {
    // ignore malformed adj param — fall back to zeros
  }
  return base;
}

// Print-preview of the VAT Return (BIR Form 2550Q, Part IV). Manual adjustment
// lines are passed through in the `adj` param so the print matches the screen.
export default async function VatReturnPrintPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string; label?: string; adj?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const now = new Date();
  const dateFrom = searchParams.dateFrom ?? `${now.getFullYear()}-01-01`;
  const dateTo = searchParams.dateTo ?? now.toISOString().slice(0, 10);
  const manual = parseManual(searchParams.adj);

  const base = await getVatReturn(company.id, new Date(`${dateFrom}T00:00:00`), new Date(`${dateTo}T23:59:59.999`));
  const L = computeVat2550Q(base, manual);

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const coverage = searchParams.label ? `For ${searchParams.label}` : `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;

  const td = "border-b border-neutral-200 px-2 py-1 align-top";
  const num = `${td} text-right font-mono whitespace-nowrap`;
  const money = (v: number) => formatPeso(v);
  const sect = (t: string) => (
    <tr><td colSpan={4} className="bg-neutral-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">{t}</td></tr>
  );
  const line = (n: string, a: ReactNode, b: ReactNode, bold = false) => (
    <tr className={bold ? "font-semibold" : ""}>
      <td className={`${td} w-8 text-neutral-500`}>{n}</td>
      <td className={td}>{VAT_2550Q_LABELS[n]}</td>
      <td className={num}>{a === "" ? "" : a}</td>
      <td className={num}>{b === "" ? "" : b}</td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title="VAT Return" coverage={coverage} />

      <table className="mt-4 w-full text-xs" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr className="border-b border-neutral-400 text-left uppercase tracking-wide text-neutral-600">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">Details of VAT Computation</th>
            <th className="px-2 py-1 text-right">Sales / Purchases</th>
            <th className="px-2 py-1 text-right">Output / Input Tax</th>
          </tr>
        </thead>
        <tbody>
          {sect(VAT_2550Q_SECTIONS.sales)}
          {line("31", money(L.l31A), money(L.l31B))}
          {line("32", money(L.l32A), "")}
          {line("33", money(L.l33A), "")}
          {line("34", money(L.l34A), money(L.l34B), true)}
          {line("35", "", money(manual.l35))}
          {line("36", "", money(manual.l36))}
          {line("37", "", money(L.l37B), true)}

          {sect(VAT_2550Q_SECTIONS.allowableInput)}
          {line("38", "", money(manual.l38))}
          {line("39", "", money(manual.l39))}
          {line("40", "", money(manual.l40))}
          {line("41", "", money(manual.l41))}
          {line("42", "", money(manual.l42))}
          {line("43", "", money(L.l43B), true)}

          {sect(VAT_2550Q_SECTIONS.currentTransactions)}
          {line("44", money(L.l44A), money(L.l44B))}
          {line("45", money(manual.l45A), money(manual.l45B))}
          {line("46", money(manual.l46A), money(manual.l46B))}
          {line("47", money(manual.l47A), money(manual.l47B))}
          {line("48", money(manual.l48A), "")}
          {line("49", money(manual.l49A), "")}
          {line("50", money(L.l50A), money(L.l50B), true)}
          {line("51", "", money(L.l51B), true)}

          {sect(VAT_2550Q_SECTIONS.adjustments)}
          {line("52", "", money(manual.l52))}
          {line("53", "", money(manual.l53))}
          {line("54", "", money(manual.l54))}
          {line("55", "", money(manual.l55))}
          {line("56", "", money(manual.l56))}
          {line("57", "", money(L.l57B), true)}
          {line("58", "", money(manual.l58))}
          {line("59", "", money(L.l59B), true)}
          {line("60", "", money(L.l60B), true)}

          <tr className="text-sm font-bold">
            <td className="border-t-2 border-neutral-800 px-2 py-2" colSpan={3}>
              61. {L.l61B >= 0 ? "Net VAT Payable" : "Excess Input Tax (carry to next period)"}
            </td>
            <td className="border-t-2 border-neutral-800 px-2 py-2 text-right font-mono">{formatPeso(Math.abs(L.l61B))}</td>
          </tr>
        </tbody>
      </table>

      <ReportFooter />
    </main>
  );
}
