import { notFound } from "next/navigation";
import { Fragment } from "react";
import { requirePostingCompany } from "@/lib/currentUser";
import { getTrialBalance, type TrialBalanceRow } from "@/lib/reports";
import { CLASSIFICATION_LABELS } from "@/lib/accounts";
import { formatPeso } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";
import type { AccountClassification } from "@prisma/client";

// Print-preview of the Trial Balance: company letterhead + report header
// (name + date coverage) above the grouped table. Opened from the report's
// Print button; the user reviews it, then prints (no auto-print).
export default async function TrialBalancePrintPage({
  searchParams,
}: {
  searchParams: { mode?: string; asOfDate?: string; dateFrom?: string; dateTo?: string };
}) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const mode = searchParams.mode === "NET_CHANGE" ? "NET_CHANGE" : "YEAR_TO_DATE";
  const fmtDate = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "");

  let result: { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number };
  let coverage: string;
  if (mode === "YEAR_TO_DATE") {
    const asOfDate = searchParams.asOfDate ?? new Date().toISOString().slice(0, 10);
    result = await getTrialBalance(company.id, { mode, asOfDate: new Date(asOfDate) });
    coverage = `As of ${fmtDate(asOfDate)}`;
  } else {
    const dateFrom = searchParams.dateFrom ?? "";
    const dateTo = searchParams.dateTo ?? "";
    result = await getTrialBalance(company.id, { mode, dateFrom: new Date(dateFrom), dateTo: new Date(dateTo) });
    coverage = `For the period ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  }

  // Group rows by classification, preserving the report's account order.
  const groups = new Map<string, TrialBalanceRow[]>();
  for (const row of result.rows) {
    const list = groups.get(row.classification) ?? [];
    if (!groups.has(row.classification)) groups.set(row.classification, list);
    list.push(row);
  }

  const companyName = company.registeredName || company.tradeName;
  const addr = [company.businessAddress, company.barangay, company.city, company.province, company.zipCode].filter(Boolean).join(", ");

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-neutral-900 print:p-0">
      <PrintControls auto={false} />

      {/* Report header */}
      <header className="border-b-2 border-neutral-800 pb-3 text-center">
        <div className="flex items-center justify-center gap-3">
          {company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="h-12 w-auto max-w-[100px] object-contain" />
          )}
          <div>
            <div className="text-base font-bold uppercase">{companyName}</div>
            {addr && <div className="text-[11px] text-neutral-600">{addr}</div>}
            {company.tin && <div className="text-[11px] text-neutral-600">TIN: {company.tin}</div>}
          </div>
        </div>
        <div className="mt-3 text-lg font-semibold">Trial Balance</div>
        <div className="text-xs text-neutral-600">{coverage}</div>
      </header>

      {/* Table */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-600">
            <th className="py-1 text-left">Code</th>
            <th className="py-1 text-left">Account</th>
            <th className="py-1 text-right">Debit</th>
            <th className="py-1 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <tr><td colSpan={4} className="py-4 text-center text-neutral-400">No balances for this period</td></tr>
          ) : (
            Array.from(groups.entries()).map(([classification, rows]) => (
              <Fragment key={classification}>
                <tr>
                  <td colSpan={4} className="pt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {CLASSIFICATION_LABELS[classification as AccountClassification] ?? classification}
                  </td>
                </tr>
                {rows.map((row) => (
                  <tr key={row.accountId} className="border-b border-neutral-100">
                    <td className="py-1 pr-2 font-mono text-neutral-500">{row.code}</td>
                    <td className="py-1 pr-2">{row.title}</td>
                    <td className="py-1 text-right font-mono">{row.debit > 0 ? formatPeso(row.debit) : ""}</td>
                    <td className="py-1 text-right font-mono">{row.credit > 0 ? formatPeso(row.credit) : ""}</td>
                  </tr>
                ))}
              </Fragment>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-800 font-semibold">
            <td colSpan={2} className="py-2">Total</td>
            <td className="py-2 text-right font-mono">{formatPeso(result.totalDebit)}</td>
            <td className="py-2 text-right font-mono">{formatPeso(result.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-4 text-[10px] text-neutral-400">Generated {new Date().toLocaleString("en-PH")}</p>
    </main>
  );
}
