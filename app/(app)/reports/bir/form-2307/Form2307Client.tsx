"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";
import { BranchFilter, type Branch } from "@/components/BranchFilter";
import type { Report2307 } from "@/lib/form2307";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const p2 = (n: number) => String(n).padStart(2, "0");

function monthRange(y: number, m: number) {
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${p2(m)}-01`, to: `${y}-${p2(m)}-${p2(last)}` };
}
function quarterRange(y: number, q: number) {
  const sm = (q - 1) * 3 + 1;
  const em = sm + 2;
  const last = new Date(y, em, 0).getDate();
  return { from: `${y}-${p2(sm)}-01`, to: `${y}-${p2(em)}-${p2(last)}` };
}

export function Form2307Client({
  tin,
  registeredName,
  locations,
}: {
  tin: string;
  registeredName: string;
  locations: Branch[];
}) {
  const now = new Date();
  // 2307 is a quarterly certificate, so default the picker to this quarter.
  const [mode, setMode] = useState<"quarter" | "month" | "range">("quarter");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState("");
  const [data, setData] = useState<Report2307 | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (mode === "month") return monthRange(year, month);
    if (mode === "quarter") return quarterRange(year, quarter);
    return { from, to };
  }, [mode, year, month, quarter, from, to]);

  useEffect(() => {
    if (!range.from || !range.to) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/reports/bir/form-2307?${params}`)
      .then((r) => r.json())
      .then((j) => active && j && Array.isArray(j.payees) && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range.from, range.to, locationId]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const num = (v: number) => (v ? formatPeso(v) : "");

  // Shared query for the printable certificates (stamped PDF).
  const printQs = (payeeId?: string) => {
    const p = new URLSearchParams({ from: range.from, to: range.to });
    if (locationId) p.set("locationId", locationId);
    if (payeeId) p.set("payeeId", payeeId);
    return p.toString();
  };
  const printOne = (payeeId: string) =>
    window.open(`/api/reports/bir/form-2307/pdf?${printQs(payeeId)}`, "_blank");
  const printAll = () => window.open(`/api/reports/bir/form-2307/pdf?${printQs()}`, "_blank");

  function exportExcel() {
    if (!data) return;
    const out: (string | number)[][] = [
      ["Certificate of Creditable Tax Withheld at Source (BIR Form 2307)"],
      [registeredName, `TIN: ${tin}`],
      [`Covering ${range.from} to ${range.to}`],
      [],
      ["Payee", "TIN", "ATC", "Description", "1st Month", "2nd Month", "3rd Month", "Income Payments", "Tax Withheld"],
    ];
    for (const p of data.payees) {
      for (const r of p.rows) {
        out.push([
          p.name, p.tin, r.atc, r.description,
          r.months[0].toFixed(2), r.months[1].toFixed(2), r.months[2].toFixed(2),
          r.income.toFixed(2), r.tax.toFixed(2),
        ]);
      }
    }
    out.push(["", "", "", "", "", "", "TOTAL", data.totals.income.toFixed(2), data.totals.tax.toFixed(2)]);
    downloadXlsx(`BIR-2307_${range.from}_to_${range.to}`, "2307", out);
  }

  const th = "px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500";
  const td = "px-3 py-1.5 align-top text-xs";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Certificate of Creditable Tax Withheld (2307)</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button
            onClick={printAll}
            disabled={!data || data.payees.length === 0}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Print all
          </button>
          <button
            onClick={exportExcel}
            disabled={!data || data.payees.length === 0}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Export to Excel
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        One certificate per ATC line per payee for the period, each splitting its income across the
        quarter&apos;s three months. Verify before issuing.
      </p>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <div>TIN: <span className="font-mono">{tin}</span></div>
        <div>Registered Name: {registeredName}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <BranchFilter locations={locations} value={locationId} onChange={setLocationId} fieldClass={field} />

        <label className="text-xs text-neutral-500">
          Period
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`mt-1 block ${field}`}>
            <option value="quarter">Quarterly</option>
            <option value="month">Monthly</option>
            <option value="range">Date range</option>
          </select>
        </label>
        {mode !== "range" && (
          <label className="text-xs text-neutral-500">
            Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`mt-1 block w-24 ${field}`} />
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
        {mode === "month" && (
          <label className="text-xs text-neutral-500">
            Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`mt-1 block ${field}`}>
              {MONTHS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
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
      </div>

      <p className="mt-3 text-xs text-neutral-400">Covering {range.from} to {range.to}.</p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.payees.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No withholding for this period — nothing to certify.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className={th}>Payee</th>
                <th className={th}>TIN</th>
                <th className={th}>ATC</th>
                <th className={`${th} text-right`}>1st Month</th>
                <th className={`${th} text-right`}>2nd Month</th>
                <th className={`${th} text-right`}>3rd Month</th>
                <th className={`${th} text-right`}>Income Payments</th>
                <th className={`${th} text-right`}>Tax Withheld</th>
                <th className={`${th} print:hidden`} />
              </tr>
            </thead>
            <tbody>
              {data.payees.map((p, pi) => (
                p.rows.map((r, ri) => (
                  <tr
                    key={`${p.id}-${r.atc}`}
                    className={`${pi % 2 === 1 ? "bg-neutral-50" : "bg-white"} ${
                      ri === 0 && pi > 0 ? "border-t border-neutral-300" : ""
                    }`}
                  >
                    <td className={td}>{ri === 0 ? <span className="font-medium text-neutral-800">{p.name}</span> : ""}</td>
                    <td className={`${td} font-mono`}>{ri === 0 ? p.tin || "—" : ""}</td>
                    <td className={td}>
                      <span className="font-mono">{r.atc}</span>
                      {r.description ? <span className="text-neutral-500"> — {r.description}</span> : null}
                    </td>
                    <td className={tdNum}>{num(r.months[0])}</td>
                    <td className={tdNum}>{num(r.months[1])}</td>
                    <td className={tdNum}>{num(r.months[2])}</td>
                    <td className={tdNum}>{num(r.income)}</td>
                    <td className={tdNum}>{num(r.tax)}</td>
                    <td className={`${td} print:hidden`}>
                      {ri === 0 && (
                        <button
                          onClick={() => printOne(p.id)}
                          className="whitespace-nowrap rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                        >
                          Print 2307
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-medium">
                <td className={td} colSpan={6}>TOTAL</td>
                <td className={tdNum}>{formatPeso(data.totals.income)}</td>
                <td className={tdNum}>{formatPeso(data.totals.tax)}</td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
