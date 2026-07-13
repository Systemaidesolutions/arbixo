"use client";

import { Fragment, useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import { CLASSIFICATION_LABELS } from "@/lib/accounts";
import type { TrialBalanceRow } from "@/lib/reports";
import type { AccountClassification } from "@prisma/client";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function TrialBalanceClient({ companyId }: { companyId: string }) {
  const [mode, setMode] = useState<"YEAR_TO_DATE" | "NET_CHANGE">("YEAR_TO_DATE");
  const [asOfDate, setAsOfDate] = useState(todayStr());
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(todayStr());
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0 });
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
      setError(data.error ?? "Failed to load trial balance.");
      return;
    }
    setRows(data.rows);
    setTotals({ totalDebit: data.totalDebit, totalCredit: data.totalCredit });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, asOfDate, dateFrom, dateTo]);

  function exportExcel() {
    const params = new URLSearchParams({ companyId, mode });
    if (mode === "YEAR_TO_DATE") params.set("asOfDate", asOfDate);
    else { params.set("dateFrom", dateFrom); params.set("dateTo", dateTo); }
    window.open(`/api/reports/trial-balance/export?${params}`, "_blank");
  }

  // Open the print-preview page (report header + company letterhead) in a new tab.
  function printReport() {
    const params = new URLSearchParams({ mode, _embed: "1" });
    if (mode === "YEAR_TO_DATE") params.set("asOfDate", asOfDate);
    else { params.set("dateFrom", dateFrom); params.set("dateTo", dateTo); }
    window.open(`/reports/trial-balance/print?${params}`, "_blank");
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const isBalanced = Math.round((totals.totalDebit - totals.totalCredit) * 100) === 0;

  // Group rows by classification, in the manual's own Chart of Accounts order.
  const byClassification = new Map<string, TrialBalanceRow[]>();
  for (const row of rows) {
    const list = byClassification.get(row.classification) ?? [];
    list.push(row);
    byClassification.set(row.classification, list);
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Trial balance</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={printReport} disabled={loading || rows.length === 0} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={exportExcel} disabled={loading || rows.length === 0} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Year-to-Date includes each account's opening balance plus every entry ever posted up to
        the date shown — this is what should tie out to the Balance Sheet. Current Net Change
        shows only movement within the period, with no opening balance.
      </p>

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
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-neutral-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-neutral-400">
                  No balances for this period
                </td>
              </tr>
            ) : (
              Array.from(byClassification.entries()).map(([classification, group]) => (
                <Fragment key={classification}>
                  <tr className="bg-neutral-50/50">
                    <td colSpan={4} className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                      {CLASSIFICATION_LABELS[classification as AccountClassification]}
                    </td>
                  </tr>
                  {group.map((row) => (
                    <tr key={row.accountId}>
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
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
            <tr>
              <td colSpan={2} className="px-3 py-2">
                Total
              </td>
              <td className="px-3 py-2 text-right font-mono">{formatPeso(totals.totalDebit)}</td>
              <td className="px-3 py-2 text-right font-mono">{formatPeso(totals.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!loading && rows.length > 0 && (
        <p className={`mt-3 text-sm ${isBalanced ? "text-green-600" : "text-red-600"}`}>
          {isBalanced
            ? "Debits equal credits — the ledger balances."
            : "Debits and credits do not match — this should never happen if every entry went through postDocument(). Investigate immediately."}
        </p>
      )}
    </main>
  );
}
