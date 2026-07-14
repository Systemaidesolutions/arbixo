"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { EquityStatement } from "@/lib/reports";

export function EquityStatementClient({ companyId }: { companyId: string }) {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<EquityStatement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/reports/equity-statement?companyId=${companyId}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [companyId, dateFrom, dateTo]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  // A movement line: "Add" when positive, "Less" when negative (shown in parens).
  const Line = ({ label, value, sign = true }: { label: string; value: number; sign?: boolean }) => {
    const neg = value < 0;
    const prefix = !sign ? "" : neg ? "Less: " : "Add: ";
    return (
      <div className="flex justify-between border-b border-neutral-100 px-3 py-2 text-sm">
        <span>{prefix}{label}</span>
        <span className="font-mono">{neg ? `(${formatPeso(Math.abs(value))})` : formatPeso(value)}</span>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Equity statement</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button
            onClick={() => window.open(`/reports/equity-statement/print?dateFrom=${dateFrom}&dateTo=${dateTo}&_embed=1`, "_blank")}
            disabled={loading || !data}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Print
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Statement of Changes in Equity for the selected period.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
      </div>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
          <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
            <span>Equity, beginning of period</span>
            <span className="font-mono">{formatPeso(data.beginningEquity)}</span>
          </div>
          <Line label={data.netIncome >= 0 ? "Net income for the period" : "Net loss for the period"} value={data.netIncome} />
          <Line label={data.netContributions >= 0 ? "Additional contributions" : "Owner's drawings"} value={data.netContributions} />
          <div className="flex justify-between border-t-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-base font-semibold">
            <span>Equity, end of period</span>
            <span className="font-mono">{formatPeso(data.endingEquity)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
