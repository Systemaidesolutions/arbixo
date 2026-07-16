"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { SalesSubsidiaryJournal } from "@/lib/salesSubsidiaryJournal";

function monthDefaults() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`, to: now.toISOString().slice(0, 10) };
}

export function SalesSubsidiaryJournalClient({ registeredName }: { registeredName: string }) {
  const def = useMemo(monthDefaults, []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<SalesSubsidiaryJournal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!from || !to) return; // a date field is mid-edit / cleared — don't fetch
    let active = true;
    setLoading(true);
    fetch(`/api/books/sales-subsidiary?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => active && j && Array.isArray(j.rows) && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const num = (v: number) => (v ? formatPeso(v) : "");
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  const cashTotal = data?.rows ? data.rows.filter((r) => r.terms === "Cash").reduce((s, r) => s + r.totalInvoice, 0) : 0;
  const acctTotal = data?.rows ? data.rows.filter((r) => r.terms === "Account").reduce((s, r) => s + r.totalInvoice, 0) : 0;

  const th = "border border-neutral-300 px-2 py-1 text-center align-middle font-medium";
  const td = "border border-neutral-200 px-2 py-1 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  return (
    <main className="mx-auto max-w-[1400px] p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Sales Subsidiary Journal</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(`/books/sales/print?from=${from}&to=${to}&_embed=1`, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={() => window.open(`/api/books/sales-subsidiary/export?from=${from}&to=${to}`, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">{registeredName}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
      </div>

      {loading || !data?.rows ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-[1200px] border-collapse text-xs">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className={th} rowSpan={2}>Date</th>
                <th className={th} rowSpan={2}>Name and Address of Buyers</th>
                <th className={th} rowSpan={2}>F</th>
                <th className={th} rowSpan={2}>Invoice Numbers</th>
                <th className={th} rowSpan={2}>VAT Reg. No.</th>
                <th className={th}>Sales</th>
                <th className={th} colSpan={2}>Taxable Sales</th>
                <th className={th} rowSpan={2}>VAT Output Tax</th>
                <th className={th} rowSpan={2}>Total Invoice Amount</th>
                <th className={th} colSpan={2}>Classification of Sales</th>
                <th className={th} colSpan={2}>Terms</th>
              </tr>
              <tr>
                <th className={th}>Exempted</th>
                <th className={th}>12%</th>
                <th className={th}>Zero Rated</th>
                <th className={th}>Local</th>
                <th className={th}>Service</th>
                <th className={th}>Cash</th>
                <th className={th}>Account</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr><td className={`${td} text-center text-neutral-400`} colSpan={14}>No sales in this period</td></tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(r.postingDate)}</td>
                    <td className={td}>
                      <div className="font-medium text-neutral-800">{r.buyerName || "—"}</div>
                      {r.buyerAddress ? <div className="text-[11px] text-neutral-500">{r.buyerAddress}</div> : null}
                    </td>
                    <td className={td} />
                    <td className={`${td} font-mono`}>{r.documentNo}</td>
                    <td className={`${td} font-mono`}>{r.vatRegNo || "—"}</td>
                    <td className={tdNum}>{num(r.exempt)}</td>
                    <td className={tdNum}>{num(r.vatable12)}</td>
                    <td className={tdNum}>{num(r.zeroRated)}</td>
                    <td className={tdNum}>{num(r.outputTax)}</td>
                    <td className={tdNum}>{num(r.totalInvoice)}</td>
                    <td className={tdNum}>{num(r.local)}</td>
                    <td className={tdNum}>{num(r.service)}</td>
                    <td className={tdNum}>{r.terms === "Cash" ? num(r.totalInvoice) : ""}</td>
                    <td className={tdNum}>{r.terms === "Account" ? num(r.totalInvoice) : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-semibold">
                <td className={td} colSpan={5}>TOTAL</td>
                <td className={tdNum}>{num(data.totals.exempt)}</td>
                <td className={tdNum}>{num(data.totals.vatable12)}</td>
                <td className={tdNum}>{num(data.totals.zeroRated)}</td>
                <td className={tdNum}>{num(data.totals.outputTax)}</td>
                <td className={tdNum}>{num(data.totals.totalInvoice)}</td>
                <td className={tdNum}>{num(data.totals.local)}</td>
                <td className={tdNum}>{num(data.totals.service)}</td>
                <td className={tdNum}>{num(cashTotal)}</td>
                <td className={tdNum}>{num(acctTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
