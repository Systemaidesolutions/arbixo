"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";

type Row = {
  id: string;
  tin: string;
  name: string;
  atcCode: string;
  atcDescription: string;
  ratePercent: number;
  income: number;
  tax: number;
};
type Data = { year: number; quarter: number; rows: Row[]; totals: { income: number; tax: number } };

export function SawtClient({ tin, registeredName }: { tin: string; registeredName: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/reports/bir/sawt?year=${year}&quarter=${quarter}`)
      .then((r) => r.json())
      .then((j) => active && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [year, quarter]);

  function exportCsv() {
    if (!data) return;
    const headers = ["TIN", "Payor", "ATC", "Description", "Rate %", "Income payment", "Tax withheld"];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of data.rows) {
      lines.push([r.tin, r.name, r.atcCode, r.atcDescription, r.ratePercent.toFixed(2), r.income.toFixed(2), r.tax.toFixed(2)].map(esc).join(","));
    }
    lines.push(["", "TOTAL", "", "", "", data.totals.income.toFixed(2), data.totals.tax.toFixed(2)].map(esc).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SAWT_${year}_Q${quarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Summary Alphalist of Withholding Taxes (SAWT)</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Creditable withholding tax withheld from the company&apos;s income by its customers/payors
        (BIR Form 2307), per payor and ATC. Verify before submitting.
      </p>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <div>TIN: <span className="font-mono">{tin}</span></div>
        <div>Registered name: {registeredName}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          Year
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`mt-1 block w-24 ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          Quarter
          <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className={`mt-1 block ${field}`}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>Q{q}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <a
            href={`/api/reports/bir/sawt/dat?year=${year}&quarter=${quarter}`}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Export BIR .DAT
          </a>
          <button onClick={exportCsv} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Export CSV
          </button>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Print
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-400">{year} Q{quarter}.</p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No creditable-withholding income in this quarter.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">TIN</th>
                <th className="px-3 py-2">Payor</th>
                <th className="px-3 py-2">ATC</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Income payment</th>
                <th className="px-3 py-2 text-right">Tax withheld</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.tin || "—"}</td>
                  <td className="px-3 py-1.5">
                    {r.name}
                    {r.atcDescription && <span className="block text-xs text-neutral-400">{r.atcDescription}</span>}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.atcCode}</td>
                  <td className="px-3 py-1.5 text-right">{r.ratePercent.toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.income)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{formatPeso(r.tax)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-medium">
                <td className="px-3 py-2" colSpan={4}>TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.income)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.tax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
