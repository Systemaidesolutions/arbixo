"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPeso } from "@/lib/format";
import { computeVat2550Q, emptyVat2550QManual, VAT_2550Q_LABELS, VAT_2550Q_SECTIONS, type VatReturn, type Vat2550QManual } from "@/lib/vat2550q";

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

export function VatReturnClient({
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
  const [manual, setManual] = useState<Vat2550QManual>(emptyVat2550QManual);
  const [data, setData] = useState<VatReturn | null>(null);
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
    fetch(`/api/reports/bir/vat-return?${params}`)
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [companyId, range.from, range.to]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const L = data ? computeVat2550Q(data, manual) : null;

  const q = `label=${encodeURIComponent(range.label)}&adj=${encodeURIComponent(JSON.stringify(manual))}`;
  const printHref = `/reports/bir/vat-return/print?dateFrom=${range.from}&dateTo=${range.to}&${q}&_embed=1`;
  const exportHref = `/api/reports/bir/vat-return/export?companyId=${companyId}&dateFrom=${range.from}&dateTo=${range.to}&${q}`;

  const setM = (k: keyof Vat2550QManual, v: number) => setManual((m) => ({ ...m, [k]: v }));

  const td = "border-b border-neutral-100 px-2 py-1.5 align-top text-sm";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;
  const lineNo = `${td} w-10 text-neutral-400`;
  const inCell = "w-28 rounded border border-neutral-300 px-2 py-1 text-right font-mono text-sm";
  const money = (v: number) => formatPeso(v);
  const mInput = (k: keyof Vat2550QManual) => (
    <input type="number" step="0.01" placeholder="0.00" value={manual[k] || ""} onChange={(e) => setM(k, Number(e.target.value))} className={inCell} />
  );

  const sect = (t: string) => (
    <tr><td colSpan={4} className="bg-neutral-50 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">{t}</td></tr>
  );
  const line = (n: string, a: ReactNode, b: ReactNode, bold = false) => (
    <tr className={bold ? "font-semibold" : ""}>
      <td className={lineNo}>{n}</td>
      <td className={td}>{VAT_2550Q_LABELS[n]}</td>
      <td className={tdNum}>{a}</td>
      <td className={tdNum}>{b}</td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">VAT Return</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(printHref, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={() => window.open(exportHref, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        BIR Form 2550Q, Part IV — Details of VAT Computation. Sales and purchases are computed from
        posted ledger entries; the adjustment / other lines are manual entries. Not a substitute for
        the actual eFPS/eBIRForms filing — verify before submitting.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        <div>TIN: <span className="font-mono">{tin}</span></div>
        <div>Registered name: {registeredName}</div>
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

      {loading || !data || !L ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6">
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Details of VAT Computation</th>
                  <th className="px-2 py-1.5 text-right">Sales / Purchases</th>
                  <th className="px-2 py-1.5 text-right">Output / Input Tax</th>
                </tr>
              </thead>
              <tbody>
                {sect(VAT_2550Q_SECTIONS.sales)}
                {line("31", money(L.l31A), money(L.l31B))}
                {line("32", money(L.l32A), "")}
                {line("33", money(L.l33A), "")}
                {line("34", money(L.l34A), money(L.l34B), true)}
                {line("35", "", mInput("l35"))}
                {line("36", "", mInput("l36"))}
                {line("37", "", money(L.l37B), true)}

                {sect(VAT_2550Q_SECTIONS.allowableInput)}
                {line("38", "", mInput("l38"))}
                {line("39", "", mInput("l39"))}
                {line("40", "", mInput("l40"))}
                {line("41", "", mInput("l41"))}
                {line("42", "", mInput("l42"))}
                {line("43", "", money(L.l43B), true)}

                {sect(VAT_2550Q_SECTIONS.currentTransactions)}
                {line("44", money(L.l44A), money(L.l44B))}
                {line("45", mInput("l45A"), mInput("l45B"))}
                {line("46", mInput("l46A"), mInput("l46B"))}
                {line("47", mInput("l47A"), mInput("l47B"))}
                {line("48", mInput("l48A"), "")}
                {line("49", mInput("l49A"), "")}
                {line("50", money(L.l50A), money(L.l50B), true)}
                {line("51", "", money(L.l51B), true)}

                {sect(VAT_2550Q_SECTIONS.adjustments)}
                {line("52", "", mInput("l52"))}
                {line("53", "", mInput("l53"))}
                {line("54", "", mInput("l54"))}
                {line("55", "", mInput("l55"))}
                {line("56", "", mInput("l56"))}
                {line("57", "", money(L.l57B), true)}
                {line("58", "", mInput("l58"))}
                {line("59", "", money(L.l59B), true)}
                {line("60", "", money(L.l60B), true)}
              </tbody>
            </table>
          </div>

          <div
            className={`mt-4 flex items-center justify-between rounded-lg border px-4 py-3 text-base font-medium ${
              L.l61B >= 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            <span>61. {L.l61B >= 0 ? "Net VAT Payable" : "Excess Input Tax (carry to next period)"}</span>
            <span className="font-mono">{formatPeso(Math.abs(L.l61B))}</span>
          </div>
        </div>
      )}
    </main>
  );
}
