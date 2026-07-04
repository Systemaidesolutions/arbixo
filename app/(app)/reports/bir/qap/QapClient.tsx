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
  income: [number, number, number];
  tax: [number, number, number];
  incomeTotal: number;
  taxTotal: number;
};
type Totals = {
  income: [number, number, number];
  tax: [number, number, number];
  incomeTotal: number;
  taxTotal: number;
};
type Data = { year: number; quarter: number; months: [string, string, string]; rows: Row[]; totals: Totals };

export function QapClient({ tin, registeredName }: { tin: string; registeredName: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/reports/bir/qap?year=${year}&quarter=${quarter}`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setData(j);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [year, quarter]);

  function exportCsv() {
    if (!data) return;
    const [m1, m2, m3] = data.months;
    const headers = [
      "TIN", "Payee", "ATC", "Description", "Rate %",
      `Income ${m1}`, `Income ${m2}`, `Income ${m3}`, "Income Total",
      `Tax ${m1}`, `Tax ${m2}`, `Tax ${m3}`, "Tax Total",
    ];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of data.rows) {
      lines.push(
        [
          r.tin, r.name, r.atcCode, r.atcDescription, r.ratePercent.toFixed(2),
          ...r.income.map((n) => n.toFixed(2)), r.incomeTotal.toFixed(2),
          ...r.tax.map((n) => n.toFixed(2)), r.taxTotal.toFixed(2),
        ].map(esc).join(",")
      );
    }
    lines.push(
      ["", "TOTAL", "", "", "",
        ...data.totals.income.map((n) => n.toFixed(2)), data.totals.incomeTotal.toFixed(2),
        ...data.totals.tax.map((n) => n.toFixed(2)), data.totals.taxTotal.toFixed(2),
      ].map(esc).join(",")
    );
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QAP_${year}_Q${quarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const months = data?.months ?? ["Month 1", "Month 2", "Month 3"];

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Quarterly Alphalist of Payees (QAP)</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Payees subjected to expanded withholding tax (BIR Form 1601-EQ), per ATC, with income payment
        and tax withheld split across the quarter's months. Verify before submitting.
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
            href={`/api/reports/bir/qap/dat?year=${year}&quarter=${quarter}`}
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

      <p className="mt-3 text-xs text-neutral-400">
        {year} Q{quarter}. The .DAT uses the shared BIR alphalist layout — validate it against the BIR
        Alphalist module before filing.
      </p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No withholding-tax payees in this quarter.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">TIN</th>
                <th className="px-3 py-2">Payee</th>
                <th className="px-3 py-2">ATC</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Inc {months[0]}</th>
                <th className="px-3 py-2 text-right">Inc {months[1]}</th>
                <th className="px-3 py-2 text-right">Inc {months[2]}</th>
                <th className="px-3 py-2 text-right">Income Total</th>
                <th className="px-3 py-2 text-right">Tax Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.tin || "—"}</td>
                  <td className="px-3 py-1.5">
                    {r.name}
                    {r.atcDescription && (
                      <span className="block text-xs text-neutral-400">{r.atcDescription}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.atcCode}</td>
                  <td className="px-3 py-1.5 text-right">{r.ratePercent.toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.income[0])}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.income[1])}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.income[2])}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.incomeTotal)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{formatPeso(r.taxTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-medium">
                <td className="px-3 py-2" colSpan={4}>TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.income[0])}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.income[1])}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.income[2])}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.incomeTotal)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.taxTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
