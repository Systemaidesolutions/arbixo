"use client";

import { Fragment, useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import { CLASSIFICATION_LABELS } from "@/lib/accounts";
import type { TrialBalanceRow } from "@/lib/reports";
import type { AccountClassification } from "@prisma/client";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_DESCRIPTION =
  "Year-to-Date includes each account's opening balance plus every entry ever posted up to the date shown — this is what should tie out to the Balance Sheet. Current Net Change shows only movement within the period, with no opening balance.";

// Trial-balance-style report. Reused as the output template for the Equity and
// Cash Flow statements by passing a title and a classification filter.
export function TrialBalanceClient({
  companyId,
  title = "Trial balance",
  description = DEFAULT_DESCRIPTION,
  classifications,
}: {
  companyId: string;
  title?: string;
  description?: string;
  classifications?: string[];
}) {
  const [mode, setMode] = useState<"YEAR_TO_DATE" | "NET_CHANGE">("YEAR_TO_DATE");
  const [asOfDate, setAsOfDate] = useState(todayStr());
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(todayStr());
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ companyId, mode });
    if (mode === "YEAR_TO_DATE") {
      params.set("asOfDate", asOfDate);
    } else {
      params.set("dateFrom", dateFrom);
      params.set("dateTo", dateTo);
    }
    const res = await fetch(`/api/reports/trial-balance?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load report.");
      return;
    }
    setRows(data.rows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, asOfDate, dateFrom, dateTo]);

  function reportParams() {
    const params = new URLSearchParams({ mode });
    if (mode === "YEAR_TO_DATE") params.set("asOfDate", asOfDate);
    else { params.set("dateFrom", dateFrom); params.set("dateTo", dateTo); }
    if (title !== "Trial balance") params.set("title", title);
    if (classifications?.length) params.set("classifications", classifications.join(","));
    return params;
  }

  function exportExcel() {
    const params = reportParams();
    params.set("companyId", companyId);
    window.open(`/api/reports/trial-balance/export?${params}`, "_blank");
  }

  // Open the print-preview page (report header + company letterhead) in a new tab.
  function printReport() {
    const params = reportParams();
    params.set("_embed", "1");
    window.open(`/reports/trial-balance/print?${params}`, "_blank");
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  // Filter to the requested classifications (whole report if none), then total.
  const shown = classifications ? rows.filter((r) => classifications.includes(r.classification)) : rows;
  const totalDebit = Math.round(shown.reduce((s, r) => s + r.debit, 0) * 100) / 100;
  const totalCredit = Math.round(shown.reduce((s, r) => s + r.credit, 0) * 100) / 100;
  const isBalanced = Math.round((totalDebit - totalCredit) * 100) === 0;

  // Group rows by classification, in the manual's own Chart of Accounts order.
  const byClassification = new Map<string, TrialBalanceRow[]>();
  for (const row of shown) {
    const list = byClassification.get(row.classification) ?? [];
    list.push(row);
    byClassification.set(row.classification, list);
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">{title}</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={printReport} disabled={loading || shown.length === 0} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={exportExcel} disabled={loading || shown.length === 0} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "YEAR_TO_DATE" | "NET_CHANGE")}
            className={`mt-1 block ${field}`}
          >
            <option value="YEAR_TO_DATE">Year to date</option>
            <option value="NET_CHANGE">Current net change</option>
          </select>
        </label>

        {mode === "YEAR_TO_DATE" ? (
          <label className="text-xs text-neutral-500">
            As of
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className={`mt-1 block ${field}`}
            />
          </label>
        ) : (
          <>
            <label className="text-xs text-neutral-500">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`mt-1 block ${field}`}
              />
            </label>
            <label className="text-xs text-neutral-500">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`mt-1 block ${field}`}
              />
            </label>
          </>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-neutral-400">
                  Loading…
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-neutral-400">
                  No balances for this period
                </td>
              </tr>
            ) : (
              (() => {
                let i = 0; // running index for continuous zebra shading across groups
                return Array.from(byClassification.entries()).map(([classification, group]) => (
                  <Fragment key={classification}>
                    <tr className="bg-neutral-100">
                      <td colSpan={4} className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        {CLASSIFICATION_LABELS[classification as AccountClassification]}
                      </td>
                    </tr>
                    {group.map((row) => (
                      <tr key={row.accountId} className={i++ % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                        <td className="px-3 py-2 font-mono text-neutral-500">{row.code}</td>
                        <td className="px-3 py-2">{row.title}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {row.debit > 0 ? formatPeso(row.debit) : ""}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {row.credit > 0 ? formatPeso(row.credit) : ""}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ));
              })()
            )}
          </tbody>
          <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
            <tr>
              <td colSpan={2} className="px-3 py-2">
                Total
              </td>
              <td className="px-3 py-2 text-right font-mono">{formatPeso(totalDebit)}</td>
              <td className="px-3 py-2 text-right font-mono">{formatPeso(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!loading && shown.length > 0 && !classifications && (
        <p className={`mt-3 text-sm ${isBalanced ? "text-green-600" : "text-red-600"}`}>
          {isBalanced
            ? "Debits equal credits — the ledger balances."
            : "Debits and credits do not match — this should never happen if every entry went through postDocument(). Investigate immediately."}
        </p>
      )}
    </main>
  );
}
