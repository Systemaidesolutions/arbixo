"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";

type Row = {
  id: string;
  documentNo: string;
  entryNo: number;
  entryDeclNo: string;
  importDate: string | null;
  releaseDate: string | null;
  sellerName: string;
  countryOrigin: string;
  dutiableValue: number;
  landedCost: number;
  vatPaid: number;
};
type Data = { rows: Row[]; totals: { dutiableValue: number; landedCost: number; vatPaid: number } };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthRange(y: number, m: number) {
  const last = new Date(y, m, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${y}-${p(m)}-01`, to: `${y}-${p(m)}-${p(last)}` };
}
function quarterRange(y: number, q: number) {
  const sm = (q - 1) * 3 + 1;
  const em = sm + 2;
  const last = new Date(y, em, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${y}-${p(sm)}-01`, to: `${y}-${p(em)}-${p(last)}` };
}
function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "—";
}

export function SliClient({ tin, registeredName }: { tin: string; registeredName: string }) {
  const now = new Date();

  const [mode, setMode] = useState<"month" | "quarter" | "range">("quarter");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (mode === "month") return monthRange(year, month);
    if (mode === "quarter") return quarterRange(year, quarter);
    return { from, to };
  }, [mode, year, month, quarter, from, to]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/reports/bir/sli?from=${range.from}&to=${range.to}`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setData(j);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range.from, range.to]);

  function exportCsv() {
    if (!data) return;
    const headers = [
      "Import Entry/Decl No.", "Import Date", "Release Date", "Supplier", "Country of Origin",
      "Dutiable Value", "Landed Cost", "VAT Paid",
    ];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of data.rows) {
      lines.push(
        [
          r.entryDeclNo, fmtDate(r.importDate), fmtDate(r.releaseDate), r.sellerName, r.countryOrigin,
          r.dutiableValue.toFixed(2), r.landedCost.toFixed(2), r.vatPaid.toFixed(2),
        ].map(esc).join(",")
      );
    }
    lines.push(
      ["", "", "", "", "TOTAL",
        data.totals.dutiableValue.toFixed(2), data.totals.landedCost.toFixed(2), data.totals.vatPaid.toFixed(2),
      ].map(esc).join(",")
    );
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SLI_${range.from}_to_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Summary List of Importations (SLI)</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Per-importation summary from posted importation entries, for RELIEF/BIR reporting. Verify
        before submitting.
      </p>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <div>TIN: <span className="font-mono">{tin}</span></div>
        <div>Registered name: {registeredName}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          Period
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`mt-1 block ${field}`}>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="range">Date range</option>
          </select>
        </label>

        {mode !== "range" && (
          <label className="text-xs text-neutral-500">
            Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`mt-1 block w-24 ${field}`} />
          </label>
        )}
        {mode === "month" && (
          <label className="text-xs text-neutral-500">
            Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`mt-1 block ${field}`}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
        )}
        {mode === "quarter" && (
          <label className="text-xs text-neutral-500">
            Quarter
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className={`mt-1 block ${field}`}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </select>
          </label>
        )}
        {mode === "range" && (
          <>
            <label className="text-xs text-neutral-500">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
            </label>
            <label className="text-xs text-neutral-500">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
            </label>
          </>
        )}

        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Export CSV
          </button>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Print
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        Covering {range.from} to {range.to}. BIR .DAT export will be added once the SLI RELIEF format
        is confirmed.
      </p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No importations in this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Entry/Decl No.</th>
                <th className="px-3 py-2">Import Date</th>
                <th className="px-3 py-2">Release Date</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2 text-right">Dutiable Value</th>
                <th className="px-3 py-2 text-right">Landed Cost</th>
                <th className="px-3 py-2 text-right">VAT Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.entryDeclNo || "—"}</td>
                  <td className="px-3 py-1.5 text-xs">{fmtDate(r.importDate)}</td>
                  <td className="px-3 py-1.5 text-xs">{fmtDate(r.releaseDate)}</td>
                  <td className="px-3 py-1.5">{r.sellerName || "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-neutral-500">{r.countryOrigin || "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.dutiableValue)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.landedCost)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.vatPaid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-medium">
                <td className="px-3 py-2" colSpan={5}>TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.dutiableValue)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.landedCost)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totals.vatPaid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
