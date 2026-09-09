"use client";

import { useEffect, useState } from "react";
import { formatPeso, formatDate, formatDateRangeCoverage } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";

type DetailRow = {
  documentNo: string;
  postingDate: string;
  transactionType: "Invoice" | "Credit Note";
  locationName: string | null;
  dueDate: string | null;
  amount: number;
  openBalance: number;
  balance: number;
};
type Group = { customerId: string; customerName: string; rows: DetailRow[]; subtotal: number };

export function CustomerBalanceDetailAllClient({
  registeredName,
  initialDateFrom = "",
  initialDateTo = "",
}: {
  registeredName: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}) {
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const coverage = formatDateRangeCoverage(dateFrom, dateTo);
  function rangeParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(extra);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p;
  }

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/reports/customer-balance?${rangeParams({ detail: "all" })}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!active) return;
        if (!r.ok || !j || !Array.isArray(j.groups)) {
          setError(j?.error ?? "Couldn't load this report. Try again.");
          return;
        }
        setGroups(j.groups);
        setGrandTotal(j.grandTotal ?? 0);
      })
      .catch(() => active && setError("Couldn't reach the server. Check your connection and try again."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  function exportAll() {
    if (!groups) return;
    const out: (string | number)[][] = [
      ["Customer Balance Detail Report", registeredName, coverage],
      [],
    ];
    for (const g of groups) {
      out.push([g.customerName]);
      out.push(["Date", "Transaction type", "Number", "Location", "Due date", "Amount", "Open balance", "Balance"]);
      for (const r of g.rows) {
        out.push([
          r.postingDate.slice(0, 10),
          r.transactionType,
          r.documentNo,
          r.locationName ?? "",
          r.dueDate ? r.dueDate.slice(0, 10) : "",
          r.amount.toFixed(2),
          r.openBalance.toFixed(2),
          r.balance.toFixed(2),
        ]);
      }
      out.push(["", "", "", "", "", "", "Subtotal", g.subtotal.toFixed(2)]);
      out.push([]);
    }
    out.push(["", "", "", "", "", "", "TOTAL", grandTotal.toFixed(2)]);
    downloadXlsx("customer-balance-detail-all", "Customer Balance Detail", out);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const th = "px-3 py-2 text-left";
  const thNum = "px-3 py-2 text-right";

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <a href="/reports/customer-balance" className="text-sm text-brand-blue hover:underline">
        ‹ Back to summary
      </a>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Customer Balance Detail Report</h1>
          <p className="mt-1 text-sm text-neutral-500">{registeredName} — {coverage}</p>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(`/reports/customer-balance/detail/print?${rangeParams({ _embed: "1" })}`, "_blank")} disabled={!groups} className={`${field} text-neutral-700 hover:bg-neutral-50 disabled:opacity-40`}>
            Print
          </button>
          <button onClick={exportAll} disabled={!groups} className={`${field} text-neutral-700 hover:bg-neutral-50 disabled:opacity-40`}>
            Export to Excel
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-3 print:hidden">
        <label className="text-xs text-neutral-500">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="text-xs text-brand-blue hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-center text-sm text-neutral-400">Loading…</p>
      ) : !groups || groups.length === 0 ? (
        <p className="mt-6 text-center text-sm text-neutral-400">No open balances</p>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((g) => (
            <div key={g.customerId} className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">{g.customerName}</div>
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Transaction type</th>
                    <th className={th}>Number</th>
                    <th className={th}>Location</th>
                    <th className={th}>Due date</th>
                    <th className={thNum}>Amount</th>
                    <th className={thNum}>Open balance</th>
                    <th className={thNum}>Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {g.rows.map((r) => (
                    <tr key={r.documentNo}>
                      <td className="px-3 py-2">{formatDate(new Date(r.postingDate))}</td>
                      <td className="px-3 py-2 text-neutral-500">{r.transactionType}</td>
                      <td className="px-3 py-2 font-mono">{r.documentNo}</td>
                      <td className="px-3 py-2 text-neutral-500">{r.locationName ?? "—"}</td>
                      <td className="px-3 py-2">{r.dueDate ? formatDate(new Date(r.dueDate)) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatPeso(r.amount)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatPeso(r.openBalance)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatPeso(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
                  <tr>
                    <td colSpan={7} className="px-3 py-2">Subtotal</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPeso(g.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
          <div className="flex justify-end rounded-lg border-2 border-neutral-300 bg-neutral-50 px-4 py-2 text-sm font-bold">
            <span className="mr-3">TOTAL</span>
            <span className="font-mono">{formatPeso(grandTotal)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
