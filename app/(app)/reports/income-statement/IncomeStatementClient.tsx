"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { IncomeStatement } from "@/lib/reports";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const p2 = (n: number) => String(n).padStart(2, "0");

function monthRange(y: number, m: number) {
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${p2(m)}-01`, to: `${y}-${p2(m)}-${p2(last)}`, label: `${MONTHS[m - 1]} ${y}` };
}
function quarterRange(y: number, q: number) {
  const sm = (q - 1) * 3 + 1;
  const em = sm + 2;
  const last = new Date(y, em, 0).getDate();
  return { from: `${y}-${p2(sm)}-01`, to: `${y}-${p2(em)}-${p2(last)}`, label: `Q${q} ${y}` };
}

export function IncomeStatementClient({ companyId }: { companyId: string }) {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "quarter" | "year" | "custom">("year");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [statement, setStatement] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (mode === "month") return monthRange(year, month);
    if (mode === "quarter") return quarterRange(year, quarter);
    if (mode === "year") return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Year ${year}` };
    return { from: dateFrom, to: dateTo, label: `${dateFrom} to ${dateTo}` };
  }, [mode, year, month, quarter, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ companyId, dateFrom: range.from, dateTo: range.to });
    fetch(`/api/reports/income-statement?${params}`)
      .then((r) => r.json())
      .then((d) => active && setStatement(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [companyId, range.from, range.to]);

  function exportCsv() {
    if (!statement) return;
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number)[][] = [
      ["Income Statement", range.label],
      [],
      ["Section", "Code", "Account", "Amount"],
    ];
    for (const l of statement.revenue) rows.push(["Revenue", l.code, l.title, l.amount.toFixed(2)]);
    rows.push(["Revenue", "", "Total revenue", statement.totalRevenue.toFixed(2)]);
    for (const l of statement.expense) rows.push(["Expenses", l.code, l.title, l.amount.toFixed(2)]);
    rows.push(["Expenses", "", "Total expenses", statement.totalExpense.toFixed(2)]);
    rows.push(["", "", statement.netIncome >= 0 ? "Net income" : "Net loss", Math.abs(statement.netIncome).toFixed(2)]);

    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income-statement_${range.from}_to_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Income statement</h1>
      <p className="mt-1 text-sm text-neutral-500">For {range.label}.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          Period
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`mt-1 block ${field}`}>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Annual</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {mode !== "custom" && (
          <label className="text-xs text-neutral-500">
            Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`mt-1 block w-24 ${field}`} />
          </label>
        )}
        {mode === "month" && (
          <label className="text-xs text-neutral-500">
            Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`mt-1 block ${field}`}>
              {MONTHS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
            </select>
          </label>
        )}
        {mode === "quarter" && (
          <label className="text-xs text-neutral-500">
            Quarter
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className={`mt-1 block ${field}`}>
              {[1, 2, 3, 4].map((q) => (<option key={q} value={q}>Q{q}</option>))}
            </select>
          </label>
        )}
        {mode === "custom" && (
          <>
            <label className="text-xs text-neutral-500">
              From
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`mt-1 block ${field}`} />
            </label>
            <label className="text-xs text-neutral-500">
              To
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`mt-1 block ${field}`} />
            </label>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Export to Excel
          </button>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Print
          </button>
        </div>
      </div>

      {loading || !statement ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Revenue</h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {statement.revenue.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-400">No revenue this period</p>
              ) : (
                statement.revenue.map((l) => (
                  <div key={l.accountId} className="flex justify-between px-3 py-2 text-sm">
                    <span><span className="font-mono text-neutral-400">{l.code}</span> {l.title}</span>
                    <span className="font-mono">{formatPeso(l.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
                <span>Total revenue</span>
                <span className="font-mono">{formatPeso(statement.totalRevenue)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Expenses</h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {statement.expense.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-400">No expenses this period</p>
              ) : (
                statement.expense.map((l) => (
                  <div key={l.accountId} className="flex justify-between px-3 py-2 text-sm">
                    <span><span className="font-mono text-neutral-400">{l.code}</span> {l.title}</span>
                    <span className="font-mono">{formatPeso(l.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
                <span>Total expenses</span>
                <span className="font-mono">{formatPeso(statement.totalExpense)}</span>
              </div>
            </div>
          </section>

          <div
            className={`flex justify-between rounded-lg border px-4 py-3 text-base font-medium ${
              statement.netIncome >= 0
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span>Net {statement.netIncome >= 0 ? "income" : "loss"}</span>
            <span className="font-mono">{formatPeso(Math.abs(statement.netIncome))}</span>
          </div>
        </div>
      )}
    </main>
  );
}
