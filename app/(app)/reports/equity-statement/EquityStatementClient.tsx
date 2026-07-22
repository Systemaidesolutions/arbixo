"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";
import { BranchFilter, type Branch } from "@/components/BranchFilter";
import type { EquityStatement } from "@/lib/reports";

export function EquityStatementClient({
  companyId,
  locations = [],
}: {
  companyId: string;
  locations?: Branch[];
}) {
  const now = new Date();
  const [locationId, setLocationId] = useState("");
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<EquityStatement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ companyId, dateFrom, dateTo });
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/reports/equity-statement?${params}`)
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [companyId, dateFrom, dateTo, locationId]);

  function exportCsv() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Statement of Changes in Equity", `${dateFrom} to ${dateTo}`],
      [],
      ["Item", "Amount"],
      ["Equity, beginning of period", data.beginningEquity.toFixed(2)],
      [data.netIncome >= 0 ? "Add: Net income for the period" : "Less: Net loss for the period", data.netIncome.toFixed(2)],
      [data.netContributions >= 0 ? "Add: Additional contributions" : "Less: Owner's drawings", data.netContributions.toFixed(2)],
      ["Equity, end of period", data.endingEquity.toFixed(2)],
    ];
    downloadXlsx(`equity-statement_${dateFrom}_to_${dateTo}`, "Changes in Equity", rows);
  }

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
            onClick={() => window.open(`/reports/equity-statement/print?dateFrom=${dateFrom}&dateTo=${dateTo}${locationId ? `&locationId=${locationId}` : ""}&_embed=1`, "_blank")}
            disabled={loading || !data}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Print
          </button>
          <button
            onClick={exportCsv}
            disabled={loading || !data}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Export to Excel
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Statement of Changes in Equity for the selected period.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <BranchFilter locations={locations} value={locationId} onChange={setLocationId} fieldClass={field} />

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
