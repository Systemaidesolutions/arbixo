"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { VatReturn } from "@/lib/bir";

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
  const [mode, setMode] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [inputTaxCarriedOver, setInputTaxCarriedOver] = useState(0);
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
  const row = "flex justify-between px-3 py-2 text-sm";

  const totalAllowableInputTax = data ? Math.max(0, data.totalCurrentInputTax + inputTaxCarriedOver) : 0;
  const vatPayable = data ? round2(data.outputTax - totalAllowableInputTax) : 0;
  const excessInputTax = vatPayable < 0 ? round2(-vatPayable) : 0;

  function round2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  const q = `carryover=${inputTaxCarriedOver || 0}&label=${encodeURIComponent(range.label)}`;
  const printHref = `/reports/bir/vat-return/print?dateFrom=${range.from}&dateTo=${range.to}&${q}&_embed=1`;
  const exportHref = `/api/reports/bir/vat-return/export?companyId=${companyId}&dateFrom=${range.from}&dateTo=${range.to}&${q}`;

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">VAT Return</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(printHref, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={() => window.open(exportHref, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        BIR Form 2550M shape, computed from posted ledger entries. Not a substitute for the actual
        eFPS/eBIRForms filing — verify before submitting.
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

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Sales/receipts for the month
            </h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              <div className={row}>
                <span>12A. Vatable sales/receipts — Private</span>
                <span className="font-mono">{formatPeso(data.vatableSalesPrivate)}</span>
              </div>
              <div className={row}>
                <span>13. Sales to Government</span>
                <span className="font-mono">{formatPeso(data.salesToGovernment)}</span>
              </div>
              <div className={row}>
                <span>14. Zero-rated sales/receipts</span>
                <span className="font-mono">{formatPeso(data.zeroRatedSales)}</span>
              </div>
              <div className={row}>
                <span>15. Exempt sales/receipts</span>
                <span className="font-mono">{formatPeso(data.exemptSales)}</span>
              </div>
              <div className={`${row} bg-neutral-50 font-medium`}>
                <span>16A. Total sales/receipts</span>
                <span className="font-mono">{formatPeso(data.totalSales)}</span>
              </div>
              <div className={`${row} bg-neutral-50 font-medium`}>
                <span>16B. Output tax due</span>
                <span className="font-mono">{formatPeso(data.outputTax)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Purchases for the month
            </h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              <div className={row}>
                <span>18A/B. Purchase of capital goods (net / input tax)</span>
                <span className="font-mono">
                  {formatPeso(data.capitalGoodsPurchases)} / {formatPeso(data.capitalGoodsInputTax)}
                </span>
              </div>
              <div className={row}>
                <span>19A/B. Other purchases (net / input tax)</span>
                <span className="font-mono">
                  {formatPeso(data.otherPurchases)} / {formatPeso(data.otherInputTax)}
                </span>
              </div>
              <div className={`${row} bg-neutral-50 font-medium`}>
                <span>Total current input tax</span>
                <span className="font-mono">{formatPeso(data.totalCurrentInputTax)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <label htmlFor="carryover">17A. Input tax carried over from previous period</label>
                <input
                  id="carryover"
                  type="number"
                  step="0.01"
                  value={inputTaxCarriedOver || ""}
                  onChange={(e) => setInputTaxCarriedOver(Number(e.target.value))}
                  className={`${field} w-32 text-right font-mono`}
                />
              </div>
              <div className={`${row} bg-neutral-50 font-medium`}>
                <span>17F. Total allowable input tax</span>
                <span className="font-mono">{formatPeso(totalAllowableInputTax)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Matches the manual's own documented limitation: only current-period transactions are
              computed automatically. Carried-over input tax is a manual adjustment here, exactly
              as it is in the original system.
            </p>
          </section>

          <div
            className={`flex justify-between rounded-lg border px-4 py-3 text-base font-medium ${
              vatPayable > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {vatPayable > 0 ? (
              <>
                <span>VAT payable</span>
                <span className="font-mono">{formatPeso(vatPayable)}</span>
              </>
            ) : (
              <>
                <span>Excess input tax (carry to next period)</span>
                <span className="font-mono">{formatPeso(excessInputTax)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
