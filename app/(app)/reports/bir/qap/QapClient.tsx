"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";
import { BranchFilter, type Branch } from "@/components/BranchFilter";
import { tinWithBranch } from "@/lib/reliefFormat";

type Row = {
  id: string;
  tin: string;
  name: string;
  reg: string;
  last: string;
  first: string;
  middle: string;
  atcCode: string;
  atcDescription: string;
  ratePercent: number;
  income: number;
  tax: number;
  monthIncome: [number, number, number];
  monthTax: [number, number, number];
};
type Data = { rows: Row[]; totals: { income: number; tax: number } };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const personName = (r: Row) =>
  r.last || r.first || r.middle ? `${r.last ?? ""}, ${r.first ?? ""} ${r.middle ?? ""}`.replace(/\s+/g, " ").trim() : "";
const DASH30 = "-".repeat(30);
const DASH18 = "-".repeat(18);
const EQ18 = "=".repeat(18);

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

export function QapClient({ tin, registeredName, locations }: { tin: string; registeredName: string; locations: Branch[] }) {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "quarter" | "range">("quarter");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState("");
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
    fetch(`/api/reports/bir/qap?from=${range.from}&to=${range.to}&locationId=${locationId}`)
      .then((r) => r.json())
      .then((j) => active && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range.from, range.to, locationId]);

  // Matches BIR's own Quarterly Alphalist (QAP) Excel template: taxpayer
  // header block, a 1st/2nd/3rd-month-of-quarter + quarter-total column
  // group, one row per payee + ATC, a Grand Total row, and an END OF REPORT
  // footer. Run this with Period = Quarterly so the 3 month columns line up
  // with an actual BIR quarter; Monthly/Date range still export, but only
  // the 1st-month column will have figures.
  function exportCsv() {
    if (!data) return;
    const periodEndDate = new Date(`${range.to}T00:00:00`);
    const out: (string | number)[][] = [
      ["Attachment to BIR Form 1601-EQ"],
      ["QUARTERLY ALPHABETICAL LIST OF PAYEES SUBJECTED TO EXPANDED WITHHOLDING TAX & PAYEES WHOSE INCOME PAYMENTS ARE EXEMPT "],
      [`FOR THE QUARTER ENDING ${MONTHS[periodEndDate.getMonth()].toUpperCase()}, ${periodEndDate.getFullYear()}`],
      [],
      [],
      [`TIN : ${tinWithBranch(tin)}`],
      [`WITHHOLDING AGENT'S NAME: ${registeredName}`],
      [],
      [],
      ["", "", "", "", "", "", "1ST MONTH OF THE QUARTER", "", "", "2ND MONTH OF THE QUARTER", "", "", "3RD MONTH OF THE QUARTER", "", "", "TOTAL FOR THE QUARTER", ""],
      ["SEQ", "TAXPAYER", "CORPORATION", "INDIVIDUAL", "ATC CODE", "NATURE OF PAYMENT", "AMOUNT OF", "TAX RATE", "AMOUNT OF", "AMOUNT OF", "TAX RATE", "AMOUNT OF", "AMOUNT OF", "TAX RATE", "AMOUNT OF", "TOTAL", "TOTAL"],
      ["NO", "IDENTIFICATION", "(Registered Name)", "(Last Name, First Name, Middle Name)", "", "", "INCOME PAYMENT", "", "TAX WITHHELD", "INCOME PAYMENT", "", "TAX WITHHELD", "INCOME PAYMENT", "", "TAX WITHHELD", "INCOME PAYMENT", "TAX WITHHELD"],
      ["", "NUMBER", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["(1)", "(2)", "(3)", "(4)", "(5)", "", "(6)", "(7)", "(8)", "(9)", "(10)", "(11)", "(12)", "(13)", "(14)", "(15)", "(16)"],
      Array(17).fill(DASH30),
    ];
    data.rows.forEach((r, i) => {
      out.push([
        i + 1, tinWithBranch(r.tin), r.reg, personName(r), r.atcCode, r.atcDescription,
        r.monthIncome[0].toFixed(2), r.ratePercent.toFixed(2), r.monthTax[0].toFixed(2),
        r.monthIncome[1].toFixed(2), r.ratePercent.toFixed(2), r.monthTax[1].toFixed(2),
        r.monthIncome[2].toFixed(2), r.ratePercent.toFixed(2), r.monthTax[2].toFixed(2),
        r.income.toFixed(2), r.tax.toFixed(2),
      ]);
    });
    const monthIncomeTotal = [0, 1, 2].map((m) => round2(data.rows.reduce((s, r) => s + r.monthIncome[m], 0)));
    const monthTaxTotal = [0, 1, 2].map((m) => round2(data.rows.reduce((s, r) => s + r.monthTax[m], 0)));
    out.push(["", "", "", "", "", "", DASH18, DASH18, DASH18, DASH18, DASH18, DASH18, DASH18, DASH18, DASH18, DASH18, DASH18]);
    out.push([
      "Grand Total :", "", "", "", "", "",
      monthIncomeTotal[0].toFixed(2), "", monthTaxTotal[0].toFixed(2),
      monthIncomeTotal[1].toFixed(2), "", monthTaxTotal[1].toFixed(2),
      monthIncomeTotal[2].toFixed(2), "", monthTaxTotal[2].toFixed(2),
      data.totals.income.toFixed(2), data.totals.tax.toFixed(2),
    ]);
    out.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", EQ18, EQ18]);
    out.push(["END OF REPORT"]);
    downloadXlsx(`QAP_${range.from}_to_${range.to}`, "QAP", out);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Alphalist of Payees — EWT (QAP)</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Payees subjected to expanded withholding tax (BIR Form 1601-EQ), per payee and ATC. Verify
        before submitting.
      </p>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <div>TIN: <span className="font-mono">{tin}</span></div>
        <div>Registered Name: {registeredName}</div>
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

        <BranchFilter locations={locations} value={locationId} onChange={setLocationId} fieldClass={field} />

        <div className="ml-auto flex gap-2">
          <a href={`/api/reports/bir/qap/dat?from=${range.from}&to=${range.to}&locationId=${locationId}`} download className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Export BIR .DAT
          </a>
          <button onClick={exportCsv} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Export to Excel</button>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Print</button>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-400">Covering {range.from} to {range.to}.</p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No withholding-tax payees in this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">TIN</th>
                <th className="px-3 py-2">Payee</th>
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
