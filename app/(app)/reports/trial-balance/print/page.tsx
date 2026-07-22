import { notFound } from "next/navigation";
import { Fragment } from "react";
import { requirePostingCompany } from "@/lib/currentUser";
import { getTrialBalance, type TrialBalanceRow } from "@/lib/reports";
import { resolveBranchScope, branchScopeLabel } from "@/lib/branchScope";
import { CLASSIFICATION_LABELS } from "@/lib/accounts";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import { ReportHeader, ReportFooter } from "@/components/ReportHeader";
import type { AccountClassification } from "@prisma/client";

// Print-preview of the Trial Balance: company letterhead + report header
// (name + date coverage) above the grouped table. Opened from the report's
// Print button; the user reviews it, then prints (no auto-print).
export default async function TrialBalancePrintPage({
  searchParams,
}: {
  searchParams: { mode?: string; asOfDate?: string; dateFrom?: string; dateTo?: string; title?: string; classifications?: string; locationId?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const mode = searchParams.mode === "NET_CHANGE" ? "NET_CHANGE" : "YEAR_TO_DATE";
  const fmtDate = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "");
  const branch = await resolveBranchScope(company.id, searchParams.locationId);

  let result: { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number };
  let coverage: string;
  if (mode === "YEAR_TO_DATE") {
    const asOfDate = searchParams.asOfDate ?? new Date().toISOString().slice(0, 10);
    result = await getTrialBalance(company.id, { mode, asOfDate: new Date(asOfDate), branch });
    coverage = `As of ${fmtDate(asOfDate)}`;
  } else {
    const dateFrom = searchParams.dateFrom ?? "";
    const dateTo = searchParams.dateTo ?? "";
    result = await getTrialBalance(company.id, { mode, dateFrom: new Date(dateFrom), dateTo: new Date(dateTo), branch });
    coverage = `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  }
  if (branch) coverage = `${coverage} · Branch: ${await branchScopeLabel(branch)}`;

  const reportTitle = searchParams.title ?? "Trial Balance";
  const classifications = searchParams.classifications?.split(",").filter(Boolean) ?? null;
  const dispRows = classifications ? result.rows.filter((r) => classifications.includes(r.classification)) : result.rows;
  const totalDebit = Math.round(dispRows.reduce((s, r) => s + r.debit, 0) * 100) / 100;
  const totalCredit = Math.round(dispRows.reduce((s, r) => s + r.credit, 0) * 100) / 100;

  // Group rows by classification, preserving the report's account order.
  const groups = new Map<string, TrialBalanceRow[]>();
  for (const row of dispRows) {
    const list = groups.get(row.classification) ?? [];
    if (!groups.has(row.classification)) groups.set(row.classification, list);
    list.push(row);
  }

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } }`}</style>
      <PrintControls auto={false} />

      <ReportHeader company={company} title={reportTitle} coverage={coverage} />

      {/* Table */}
      <table className="mt-4 w-full text-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <thead>
          <tr className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-600">
            <th className="py-1 text-left">Code</th>
            <th className="py-1 text-left">Account</th>
            <th className="py-1 text-right">Debit</th>
            <th className="py-1 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {dispRows.length === 0 ? (
            <tr><td colSpan={4} className="py-4 text-center text-neutral-400">No balances for this period</td></tr>
          ) : (
            (() => {
              let i = 0; // running index for continuous zebra shading across groups
              return Array.from(groups.entries()).map(([classification, rows]) => (
                <Fragment key={classification}>
                  <tr>
                    <td colSpan={4} className="pt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {CLASSIFICATION_LABELS[classification as AccountClassification] ?? classification}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.accountId} className={i++ % 2 === 1 ? "bg-neutral-100" : "bg-white"}>
                      <td className="py-1 pl-2 pr-2 font-mono text-neutral-500">{row.code}</td>
                      <td className="py-1 pr-2">{row.title}</td>
                      <td className="py-1 pr-2 text-right font-mono">{row.debit > 0 ? formatPeso(row.debit) : ""}</td>
                      <td className="py-1 pr-2 text-right font-mono">{row.credit > 0 ? formatPeso(row.credit) : ""}</td>
                    </tr>
                  ))}
                </Fragment>
              ));
            })()
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-800 font-semibold">
            <td colSpan={2} className="py-2">Total</td>
            <td className="py-2 text-right font-mono">{formatPeso(totalDebit)}</td>
            <td className="py-2 text-right font-mono">{formatPeso(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>

      <ReportFooter />
    </main>
  );
}
