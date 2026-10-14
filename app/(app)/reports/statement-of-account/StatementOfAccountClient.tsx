"use client";

import { useEffect, useState } from "react";
import { formatPeso, formatDate } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";
import { BranchFilter, type Branch } from "@/components/BranchFilter";
import type { Customer } from "@prisma/client";

type Row = {
  id: string;
  postingDate: string;
  dueDate: string | null;
  reference: string;
  description: string;
  amount: number;
  balance: number;
};

function customerName(c: Customer) {
  return c.tradeName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
}

export function StatementOfAccountClient({
  companyId,
  customers,
  locations = [],
}: {
  companyId: string;
  customers: Customer[];
  locations?: Branch[];
}) {
  const [locationId, setLocationId] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [balanceForward, setBalanceForward] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ companyId, customerId, dateFrom, dateTo });
    if (locationId) params.set("locationId", locationId);
    const res = await fetch(`/api/reports/statement-of-account?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load statement.");
      return;
    }
    setBalanceForward(data.balanceForward);
    setTotal(data.total);
    setRows(data.rows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, dateFrom, dateTo, locationId]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  function exportCsv() {
    const out: (string | number)[][] = [
      ["Statement of Account", customers.find((c) => c.id === customerId) ? customerName(customers.find((c) => c.id === customerId)!) : "", `${dateFrom} to ${dateTo}`],
      [],
      ["Date", "Due Date", "Reference", "Description", "Amount", "Balance"],
      ["", "", "", "Balance Forward", "", balanceForward.toFixed(2)],
      ...rows.map((r) => [
        r.postingDate.slice(0, 10),
        r.dueDate ? r.dueDate.slice(0, 10) : "",
        r.reference,
        r.description,
        r.amount.toFixed(2),
        r.balance.toFixed(2),
      ]),
      ["", "", "", "TOTAL", "", total.toFixed(2)],
    ];
    downloadXlsx(`statement-of-account_${dateFrom}_to_${dateTo}`, "Statement of Account", out);
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">Statement of Account</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button
            onClick={() =>
              window.open(
                `/reports/statement-of-account/print?customerId=${customerId}&dateFrom=${dateFrom}&dateTo=${dateTo}${locationId ? `&locationId=${locationId}` : ""}&_embed=1`,
                "_blank"
              )
            }
            disabled={!customerId || loading}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Print
          </button>
          <button onClick={exportCsv} disabled={!customerId || loading} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
            Export to Excel
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        A client-ready billing statement for one customer — charges, payments, and the running balance they owe.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4">
        <BranchFilter locations={locations} value={locationId} onChange={setLocationId} fieldClass={field} />

        <label className="text-xs text-neutral-500">
          Customer
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-1 block ${field}`}>
            {customers.length === 0 && <option value="">None yet</option>}
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {customerName(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Due Date</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <tr className="bg-neutral-50/50">
              <td colSpan={5} className="px-3 py-2 text-xs font-medium text-neutral-500">
                Balance Forward
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-medium text-neutral-500">{formatPeso(balanceForward)}</td>
            </tr>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-neutral-400">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-neutral-400">No activity for this period</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{formatDate(new Date(r.postingDate))}</td>
                  <td className="px-3 py-2 text-neutral-500">{r.dueDate ? formatDate(new Date(r.dueDate)) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.reference}</td>
                  <td className="px-3 py-2 text-neutral-500">{r.description || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPeso(r.amount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPeso(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
            <tr>
              <td colSpan={5} className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2 text-right font-mono">{formatPeso(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}
