"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { PurchaseSubsidiaryJournal } from "@/lib/purchaseSubsidiaryJournal";

function monthDefaults() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`, to: now.toISOString().slice(0, 10) };
}

export function PurchaseSubsidiaryJournalClient({ registeredName }: { registeredName: string }) {
  const def = useMemo(monthDefaults, []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<PurchaseSubsidiaryJournal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/books/purchase-subsidiary?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => active && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const num = (v: number) => (v ? formatPeso(v) : "");
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  const cashTotal = data ? data.rows.filter((r) => r.terms === "Cash").reduce((s, r) => s + r.totalInvoice, 0) : 0;
  const acctTotal = data ? data.rows.filter((r) => r.terms === "Account").reduce((s, r) => s + r.totalInvoice, 0) : 0;

  const th = "border border-neutral-300 px-2 py-1 text-center align-middle font-medium";
  const td = "border border-neutral-200 px-2 py-1 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;

  return (
    <main className="mx-auto max-w-[1500px] p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Purchase Subsidiary Journal</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(`/books/purchases/print?from=${from}&to=${to}&_embed=1`, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={() => window.open(`/api/books/purchase-subsidiary/export?from=${from}&to=${to}`, "_blank")} disabled={!data} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
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

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-[1300px] border-collapse text-xs">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className={th} rowSpan={2}>Date</th>
                <th className={th} rowSpan={2}>Name and Address of Suppliers</th>
                <th className={th} rowSpan={2}>F</th>
                <th className={th} rowSpan={2}>Invoice Numbers</th>
                <th className={th} rowSpan={2}>VAT Reg. No.</th>
                <th className={th} colSpan={2}>VAT Purchases (Goods)</th>
                <th className={th} colSpan={2}>Non-VAT Purchases (Goods)</th>
                <th className={th} rowSpan={2}>Input VAT</th>
                <th className={th} rowSpan={2}>Total Invoice Amount</th>
                <th className={th} rowSpan={2}>Name of Account</th>
                <th className={th} colSpan={2}>General Ledger</th>
                <th className={th} colSpan={2}>Terms</th>
              </tr>
              <tr>
                <th className={th}>Local</th>
                <th className={th}></th>
                <th className={th}>Local</th>
                <th className={th}>Zero Rated</th>
                <th className={th}>Debit</th>
                <th className={th}>Credit</th>
                <th className={th}>Cash</th>
                <th className={th}>Account</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr><td className={`${td} text-center text-neutral-400`} colSpan={16}>No purchases in this period</td></tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(r.postingDate)}</td>
                    <td className={td}>
                      <div className="font-medium text-neutral-800">{r.supplierName || "—"}</div>
                      {r.supplierAddress ? <div className="text-[11px] text-neutral-500">{r.supplierAddress}</div> : null}
                    </td>
                    <td className={td} />
                    <td className={`${td} font-mono`}>{r.documentNo}</td>
                    <td className={`${td} font-mono`}>{r.vatRegNo || "—"}</td>
                    <td className={tdNum}>{num(r.vatPurchLocal)}</td>
                    <td className={td} />
                    <td className={tdNum}>{num(r.nonVatLocal)}</td>
                    <td className={tdNum}>{num(r.nonVatZero)}</td>
                    <td className={tdNum}>{num(r.inputVat)}</td>
                    <td className={tdNum}>{num(r.totalInvoice)}</td>
                    <td className={td}>{r.accountName || "—"}</td>
                    <td className={tdNum}>{num(r.glDebit)}</td>
                    <td className={tdNum}>{num(r.glCredit)}</td>
                    <td className={tdNum}>{r.terms === "Cash" ? num(r.totalInvoice) : ""}</td>
                    <td className={tdNum}>{r.terms === "Account" ? num(r.totalInvoice) : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-semibold">
                <td className={td} colSpan={5}>TOTAL</td>
                <td className={tdNum}>{num(data.totals.vatPurchLocal)}</td>
                <td className={td} />
                <td className={tdNum}>{num(data.totals.nonVatLocal)}</td>
                <td className={tdNum}>{num(data.totals.nonVatZero)}</td>
                <td className={tdNum}>{num(data.totals.inputVat)}</td>
                <td className={tdNum}>{num(data.totals.totalInvoice)}</td>
                <td className={td} />
                <td className={tdNum}>{num(data.totals.glDebit)}</td>
                <td className={tdNum}>{num(data.totals.glCredit)}</td>
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
