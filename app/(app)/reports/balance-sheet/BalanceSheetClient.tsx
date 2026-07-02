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

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Balance sheet</h1>
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
