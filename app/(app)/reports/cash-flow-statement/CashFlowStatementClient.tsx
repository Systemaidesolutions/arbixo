"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatPeso } from "@/lib/format";
import type { CashFlowStatement, CashFlowLine } from "@/lib/reports";

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

// -1,234.56 → "-PHP 1,234.56"
function php(n: number) {
  return `${n < 0 ? "-" : ""}PHP ${formatPeso(Math.abs(n))}`;
}

export function CashFlowStatementClient({ companyId }: { companyId: string }) {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "quarter" | "year" | "custom">("year");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<CashFlowStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdj, setShowAdj] = useState(false);

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
    fetch(`/api/reports/cash-flow-statement?${params}`)
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [companyId, range.from, range.to]);

  function exportCsv() {
    if (!data) return;
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number)[][] = [["Statement of Cash Flows", range.label], [], ["Account Name", "Total"]];
    rows.push(["Cash flows from operating activities", ""]);
    rows.push(["Profit for the year", data.netIncome.toFixed(2)]);
    rows.push(["Adjustments for non-cash income and expenses:", data.operatingAdjustmentsTotal.toFixed(2)]);
    for (const l of data.operatingAdjustments) rows.push([`  ${l.code ? `${l.code} ` : ""}${l.title}`, l.amount.toFixed(2)]);
    rows.push(["Net cash from operating activities", data.netOperating.toFixed(2)]);
    if (data.investing.length) {
      rows.push(["Cash flows from investing activities", ""]);
      for (const l of data.investing) rows.push([`${l.code ? `${l.code} ` : ""}${l.title}`, l.amount.toFixed(2)]);
      rows.push(["Net cash from investing activities", data.netInvesting.toFixed(2)]);
    }
    if (data.financing.length) {
      rows.push(["Cash flows from financing activities", ""]);
      for (const l of data.financing) rows.push([`${l.code ? `${l.code} ` : ""}${l.title}`, l.amount.toFixed(2)]);
      rows.push([data.netFinancing < 0 ? "Net cash used in financing activities" : "Net cash from financing activities", data.netFinancing.toFixed(2)]);
    }
    rows.push(["NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS", data.netChange.toFixed(2)]);
    rows.push(["Cash and cash equivalents at beginning of year", data.beginningCash.toFixed(2)]);
    rows.push(["CASH AND CASH EQUIVALENTS AT END OF YEAR", data.endingCash.toFixed(2)]);
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-flow-statement_${range.from}_to_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const rowCls = "flex items-center justify-between px-3 py-2 text-sm";
  const amt = (v: number) => <span className="font-mono">{php(v)}</span>;
  const lineList = (lines: CashFlowLine[]) =>
    lines.map((l, i) => (
      <div key={i} className={`${rowCls} pl-8`}>
        <span className="text-neutral-600">{l.code ? <span className="font-mono text-neutral-400">{l.code} </span> : null}{l.title}</span>
        {amt(l.amount)}
      </div>
    ));

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Cash flow statement</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(`/reports/cash-flow-statement/print?dateFrom=${range.from}&dateTo=${range.to}&_embed=1`, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={exportCsv} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Statement of Cash Flows — {range.label} (indirect method).</p>

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
              {[1, 2, 3, 4].map((qn) => (<option key={qn} value={qn}>Q{qn}</option>))}
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
      </div>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
            <span>Account Name</span><span>Total</span>
          </div>

          {/* Operating */}
          <div className="bg-neutral-50/60 px-3 py-2 text-sm text-neutral-600">Cash flows from operating activities</div>
          <div className={rowCls}><span className="pl-2 text-neutral-600">Profit for the year</span>{amt(data.netIncome)}</div>
          <button onClick={() => setShowAdj((s) => !s)} className={`${rowCls} w-full text-left hover:bg-neutral-50`}>
            <span className="flex items-center gap-1 pl-2 text-neutral-600">
              <ChevronRight size={14} className={`transition-transform ${showAdj ? "rotate-90" : ""}`} />
              Adjustments for non-cash income and expenses:
            </span>
            {amt(data.operatingAdjustmentsTotal)}
          </button>
          {showAdj && lineList(data.operatingAdjustments)}
          <div className={`${rowCls} font-semibold text-neutral-800`}><span className="pl-2">Net cash from operating activities</span>{amt(data.netOperating)}</div>

          {/* Investing */}
          {data.investing.length > 0 && (
            <>
              <div className="bg-neutral-50/60 px-3 py-2 text-sm text-neutral-600">Cash flows from investing activities</div>
              {lineList(data.investing)}
              <div className={`${rowCls} font-semibold text-neutral-800`}><span className="pl-2">Net cash from investing activities</span>{amt(data.netInvesting)}</div>
            </>
          )}

          {/* Financing */}
          {data.financing.length > 0 && (
            <>
              <div className="bg-neutral-50/60 px-3 py-2 text-sm text-neutral-600">Cash flows from financing activities</div>
              {lineList(data.financing)}
              <div className={`${rowCls} font-semibold text-neutral-800`}><span className="pl-2">{data.netFinancing < 0 ? "Net cash used in financing activities" : "Net cash from financing activities"}</span>{amt(data.netFinancing)}</div>
            </>
          )}

          <div className={`${rowCls} bg-neutral-50 font-semibold text-neutral-800`}><span>NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS</span>{amt(data.netChange)}</div>
          <div className={`${rowCls} bg-neutral-50 font-semibold text-neutral-800`}><span>Cash and cash equivalents at beginning of year</span>{amt(data.beginningCash)}</div>
          <div className={`${rowCls} bg-neutral-100 text-base font-bold text-neutral-900`}><span>CASH AND CASH EQUIVALENTS AT END OF YEAR</span>{amt(data.endingCash)}</div>
        </div>
      )}
    </main>
  );
}
