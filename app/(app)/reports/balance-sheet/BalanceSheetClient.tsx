"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { BalanceSheet } from "@/lib/reports";

function fiscalYearStartFor(asOfDate: string, fiscalMonthEnd: number): string {
  const d = new Date(asOfDate);
  const startMonth = fiscalMonthEnd % 12; // month AFTER fiscalMonthEnd, 0-indexed
  const year = d.getMonth() >= startMonth ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(year, startMonth, 1).toISOString().slice(0, 10);
}

const p2 = (n: number) => String(n).padStart(2, "0");
// Period-end dates relative to today, for the quick "as of" presets.
function periodEnds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const q = Math.floor(now.getMonth() / 3) + 1;
  const monthLast = new Date(y, m, 0).getDate();
  const qEndMonth = q * 3;
  const qLast = new Date(y, qEndMonth, 0).getDate();
  return {
    month: `${y}-${p2(m)}-${p2(monthLast)}`,
    quarter: `${y}-${p2(qEndMonth)}-${p2(qLast)}`,
    year: `${y}-12-31`,
  };
}

export function BalanceSheetClient({
  companyId,
  fiscalMonthEnd,
}: {
  companyId: string;
  fiscalMonthEnd: number;
}) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const defaultFiscalStart = useMemo(() => fiscalYearStartFor(asOfDate, fiscalMonthEnd), [asOfDate, fiscalMonthEnd]);
  const [fiscalYearStart, setFiscalYearStart] = useState(defaultFiscalStart);
  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep the fiscal year start in sync when asOfDate changes, unless the
  // user has manually overridden it away from the computed default.
  useEffect(() => {
    setFiscalYearStart(defaultFiscalStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFiscalStart]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ companyId, asOfDate, fiscalYearStart });
    const res = await fetch(`/api/reports/balance-sheet?${params}`);
    const data = await res.json();
    setLoading(false);
    setSheet(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate, fiscalYearStart]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const isBalanced = sheet ? Math.round((sheet.totalAssets - sheet.totalLiabilitiesAndEquity) * 100) === 0 : true;

  function exportCsv() {
    if (!sheet) return;
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number)[][] = [
      ["Balance Sheet", `As of ${asOfDate}`],
      [],
      ["Section", "Code", "Account", "Amount"],
    ];
    for (const l of sheet.assets) rows.push(["Assets", l.code, l.title, l.amount.toFixed(2)]);
    rows.push(["Assets", "", "Total assets", sheet.totalAssets.toFixed(2)]);
    for (const l of sheet.liabilities) rows.push(["Liabilities", l.code, l.title, l.amount.toFixed(2)]);
    rows.push(["Liabilities", "", "Total liabilities", sheet.totalLiabilities.toFixed(2)]);
    for (const l of sheet.equity) rows.push(["Equity", l.code, l.title, l.amount.toFixed(2)]);
    rows.push(["Equity", "", "Current period earnings", sheet.currentPeriodEarnings.toFixed(2)]);
    rows.push(["Equity", "", "Prior unclosed earnings", sheet.priorUnclosedEarnings.toFixed(2)]);
    rows.push(["Equity", "", "Total equity & earnings", sheet.totalEquityAndEarnings.toFixed(2)]);
    rows.push(["", "", "Total liabilities & equity", sheet.totalLiabilitiesAndEquity.toFixed(2)]);

    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet_${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Balance sheet</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(`/reports/balance-sheet/print?asOfDate=${asOfDate}&fiscalYearStart=${fiscalYearStart}&_embed=1`, "_blank")} disabled={!sheet} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={exportCsv} disabled={!sheet} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">As of the date below.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4">
        <label className="text-xs text-neutral-500">
          As of
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
        <label className="text-xs text-neutral-500">
          Fiscal year start
          <input
            type="date"
            value={fiscalYearStart}
            onChange={(e) => setFiscalYearStart(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Quick as-of</span>
          <div className="flex gap-1">
            {(() => {
              const pe = periodEnds();
              const btn = "rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50";
              return (
                <>
                  <button type="button" onClick={() => setAsOfDate(pe.month)} className={btn}>Month-end</button>
                  <button type="button" onClick={() => setAsOfDate(pe.quarter)} className={btn}>Quarter-end</button>
                  <button type="button" onClick={() => setAsOfDate(pe.year)} className={btn}>Year-end</button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {loading || !sheet ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Assets</h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {sheet.assets.map((l) => (
                <div key={l.accountId} className="flex justify-between px-3 py-2 text-sm">
                  <span>
                    <span className="font-mono text-neutral-400">{l.code}</span> {l.title}
                  </span>
                  <span className="font-mono">{formatPeso(l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
                <span>Total assets</span>
                <span className="font-mono">{formatPeso(sheet.totalAssets)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Liabilities</h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {sheet.liabilities.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-400">No liabilities</p>
              ) : (
                sheet.liabilities.map((l) => (
                  <div key={l.accountId} className="flex justify-between px-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-neutral-400">{l.code}</span> {l.title}
                    </span>
                    <span className="font-mono">{formatPeso(l.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
                <span>Total liabilities</span>
                <span className="font-mono">{formatPeso(sheet.totalLiabilities)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Equity</h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {sheet.equity.map((l) => (
                <div key={l.accountId} className="flex justify-between px-3 py-2 text-sm">
                  <span>
                    <span className="font-mono text-neutral-400">{l.code}</span> {l.title}
                  </span>
                  <span className="font-mono">{formatPeso(l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 text-sm">
                <span>Current period earnings</span>
                <span className="font-mono">{formatPeso(sheet.currentPeriodEarnings)}</span>
              </div>
              {Math.abs(sheet.priorUnclosedEarnings) > 0.005 && (
                <div className="flex justify-between px-3 py-2 text-sm text-amber-700">
                  <span>Prior years' unclosed earnings</span>
                  <span className="font-mono">{formatPeso(sheet.priorUnclosedEarnings)}</span>
                </div>
              )}
              <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
                <span>Total equity</span>
                <span className="font-mono">{formatPeso(sheet.totalEquityAndEarnings)}</span>
              </div>
            </div>
            {Math.abs(sheet.priorUnclosedEarnings) > 0.005 && (
              <p className="mt-2 text-xs text-amber-700">
                Prior years' revenue and expense haven't been closed to equity via a General
                Journal entry — this line makes the sheet balance anyway, but consider closing the
                books for that period.
              </p>
            )}
          </section>

          <div className="flex justify-between rounded-lg bg-neutral-50 px-4 py-3 text-base font-medium">
            <span>Total liabilities and equity</span>
            <span className="font-mono">{formatPeso(sheet.totalLiabilitiesAndEquity)}</span>
          </div>

          <p className={`text-sm ${isBalanced ? "text-green-600" : "text-red-600"}`}>
            {isBalanced
              ? "Assets equal liabilities plus equity — the sheet balances."
              : "Assets don't equal liabilities plus equity. Check for opening balances that weren't themselves entered in a balanced way."}
          </p>
        </div>
      )}
    </main>
  );
}
