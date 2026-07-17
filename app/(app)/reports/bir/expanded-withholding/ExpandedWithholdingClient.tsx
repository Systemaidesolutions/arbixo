"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPeso } from "@/lib/format";
import {
  computeEwt1601,
  emptyEwt1601Manual,
  EWT_1601_LABELS,
  type ExpandedWithholding,
  type Ewt1601Manual,
} from "@/lib/ewt1601eq";

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

export function ExpandedWithholdingClient({
  companyId,
  tin,
  registeredName,
}: {
  companyId: string;
  tin: string;
  registeredName: string;
}) {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "quarter" | "year" | "custom">("quarter");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [manual, setManual] = useState<Ewt1601Manual>(emptyEwt1601Manual);
  const [data, setData] = useState<ExpandedWithholding | null>(null);
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
    fetch(`/api/reports/bir/expanded-withholding?${params}`)
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [companyId, range.from, range.to]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const T = data ? computeEwt1601(data.totalWithheld, manual) : null;

  const q = `label=${encodeURIComponent(range.label)}&adj=${encodeURIComponent(JSON.stringify(manual))}`;
  const printHref = `/reports/bir/expanded-withholding/print?dateFrom=${range.from}&dateTo=${range.to}&${q}&_embed=1`;
  const exportHref = `/api/reports/bir/expanded-withholding/export?companyId=${companyId}&dateFrom=${range.from}&dateTo=${range.to}&${q}`;

  const setM = (k: keyof Ewt1601Manual, v: number) => setManual((m) => ({ ...m, [k]: v }));

  const td = "border-b border-neutral-100 px-2 py-1.5 align-top text-sm";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;
  const lineNo = `${td} w-10 text-neutral-400`;
  const inCell = "w-32 rounded border border-neutral-300 px-2 py-1 text-right font-mono text-sm";
  const money = (v: number) => formatPeso(v);
  const mInput = (k: keyof Ewt1601Manual) => (
    <input type="number" step="0.01" placeholder="0.00" value={manual[k] || ""} onChange={(e) => setM(k, Number(e.target.value))} className={inCell} />
  );
  const line = (n: string, a: ReactNode, bold = false) => (
    <tr className={bold ? "font-semibold" : ""}>
      <td className={lineNo}>{n}</td>
      <td className={td}>{EWT_1601_LABELS[n]}</td>
      <td className={tdNum}>{a}</td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Expanded Withholding Tax</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(printHref, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={() => window.open(exportHref, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        BIR Form 1601-EQ, Part II — Computation of Tax. Tax withheld is computed from posted
        purchases / cash disbursements per ATC; remittances and penalties are manual entries. Not a
        substitute for the actual eFPS/eBIRForms filing — verify before submitting.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <div>TIN: <span className="font-mono">{tin}</span></div>
        <div>Registered Name: {registeredName}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          Period
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`mt-1 block ${field}`}>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Annual</option>
            <option value="custom">Date range</option>
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
      <p className="mt-2 text-xs text-neutral-400">For {range.label}.</p>

      {loading || !data || !T ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          {/* ATC breakdown — items 13-18 */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">ATC</th>
                  <th className="px-2 py-1.5 text-right">Tax Base</th>
                  <th className="px-2 py-1.5 text-right">Tax Rate (%)</th>
                  <th className="px-2 py-1.5 text-right">Tax Withheld</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-neutral-400">No withholding for this period</td></tr>
                ) : (
                  data.rows.map((r, i) => (
                    <tr key={r.atcCode}>
                      <td className={lineNo}>{13 + i}</td>
                      <td className={td}>
                        <span className="font-mono">{r.atcCode}</span>
                        {r.atcDescription ? <span className="text-neutral-500"> — {r.atcDescription}</span> : null}
                      </td>
                      <td className={tdNum}>{money(r.taxBase)}</td>
                      <td className={tdNum}>{r.ratePercent.toFixed(2)}</td>
                      <td className={tdNum}>{money(r.taxWithheld)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Computation — items 19-30 */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[560px]">
              <tbody>
                {line("19", money(T.l19), true)}
                {line("20", mInput("l20"))}
                {line("21", mInput("l21"))}
                {line("22", mInput("l22"))}
                {line("23", mInput("l23"))}
                {line("24", money(T.l24), true)}
                {line("25", money(T.l25), true)}
                {line("26", mInput("l26"))}
                {line("27", mInput("l27"))}
                {line("28", mInput("l28"))}
                {line("29", money(T.l29), true)}
              </tbody>
            </table>
          </div>

          <div
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-base font-medium ${
              T.l30 >= 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            <span>30. {T.l30 >= 0 ? "Total Amount Still Due" : "Over-remittance"}</span>
            <span className="font-mono">{formatPeso(Math.abs(T.l30))}</span>
          </div>
        </div>
      )}
    </main>
  );
}
