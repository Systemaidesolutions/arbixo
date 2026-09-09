"use client";

import { useEffect, useState } from "react";
import { formatPeso, formatDate, formatDateRangeCoverage } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";

type SummaryRow = { customerId: string; code: string; name: string; balance: number };
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

export function CustomerBalanceClient({ companyId, registeredName }: { companyId: string; registeredName: string }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const coverage = formatDateRangeCoverage(dateFrom, dateTo);
  function rangeParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(extra);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p;
  }

  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<DetailRow[] | null>(null);
  const [detailTotal, setDetailTotal] = useState(0);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingSummary(true);
    setSummaryError(null);
    fetch(`/api/reports/customer-balance?${rangeParams()}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!active) return;
        if (!r.ok || !j || !Array.isArray(j.rows)) {
          setSummaryError(j?.error ?? "Couldn't load this report. Try again.");
          return;
        }
        setSummary(j.rows);
      })
      .catch(() => active && setSummaryError("Couldn't reach the server. Check your connection and try again."))
      .finally(() => active && setLoadingSummary(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!selected) return;
    loadDetail(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  function loadDetail(customerId: string) {
    setDetail(null);
    setDetailError(null);
    setLoadingDetail(true);
    fetch(`/api/reports/customer-balance?${rangeParams({ customerId })}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j || !Array.isArray(j.rows)) {
          setDetailError(j?.error ?? "Couldn't load this customer's balance. Try again.");
          return;
        }
        setDetail(j.rows);
        setDetailTotal(j.totalBalance ?? 0);
      })
      .catch(() => setDetailError("Couldn't reach the server. Check your connection and try again."))
      .finally(() => setLoadingDetail(false));
  }

  function openDetail(customerId: string, name: string) {
    setSelected({ id: customerId, name });
    loadDetail(customerId);
  }

  function exportSummary() {
    if (!summary) return;
    const out: (string | number)[][] = [
      ["Customer Balance Summary", registeredName, coverage],
      [],
      ["Customer", "Total"],
      ...summary.map((r) => [r.name, r.balance.toFixed(2)]),
      ["TOTAL", summary.reduce((s, r) => s + r.balance, 0).toFixed(2)],
    ];
    downloadXlsx("customer-balance-summary", "Customer Balance Summary", out);
  }

  function exportDetail() {
    if (!detail || !selected) return;
    const out: (string | number)[][] = [
      [selected.name, "Customer Balance Detail Report", coverage],
      [],
      ["Date", "Transaction type", "Number", "Location", "Due date", "Amount", "Open balance", "Balance"],
      ...detail.map((r) => [
        r.postingDate.slice(0, 10),
        r.transactionType,
        r.documentNo,
        r.locationName ?? "",
        r.dueDate ? r.dueDate.slice(0, 10) : "",
        r.amount.toFixed(2),
        r.openBalance.toFixed(2),
        r.balance.toFixed(2),
      ]),
    ];
    downloadXlsx(`customer-balance-detail_${selected.name}`, "Customer Balance Detail", out);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  const dateFilter = (
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
  );

  if (selected) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <button onClick={() => setSelected(null)} className="text-sm text-brand-blue hover:underline">
          ‹ Back to summary
        </button>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium text-neutral-900">{selected.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">Customer Balance Detail Report — {coverage}</p>
          </div>
          <div className="flex shrink-0 gap-2 print:hidden">
            <button
              onClick={() => window.open(`/reports/customer-balance/print?${rangeParams({ customerId: selected.id, _embed: "1" })}`, "_blank")}
              disabled={!detail}
              className={`${field} text-neutral-700 hover:bg-neutral-50 disabled:opacity-40`}
            >
              Print
            </button>
            <button onClick={exportDetail} disabled={!detail} className={`${field} text-neutral-700 hover:bg-neutral-50 disabled:opacity-40`}>
              Export to Excel
            </button>
          </div>
        </div>

        {dateFilter}

        {detailError && <p className="mt-4 text-sm text-red-600">{detailError}</p>}

        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Transaction type</th>
                <th className="px-3 py-2 text-left">Number</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Due date</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Open balance</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loadingDetail ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-neutral-400">Loading…</td>
                </tr>
              ) : !detail || detail.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-neutral-400">No open balance</td>
                </tr>
              ) : (
                detail.map((r) => (
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
                ))
              )}
            </tbody>
            {detail && detail.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
                <tr>
                  <td colSpan={7} className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPeso(detailTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Customer Balance Summary</h1>
          <p className="mt-1 text-sm text-neutral-500">{registeredName} — {coverage}</p>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <a href={`/reports/customer-balance/detail?${rangeParams()}`} className={`${field} text-neutral-700 hover:bg-neutral-50`}>
            Detail report
          </a>
          <button onClick={() => window.open(`/reports/customer-balance/print?${rangeParams({ _embed: "1" })}`, "_blank")} disabled={!summary} className={`${field} text-neutral-700 hover:bg-neutral-50 disabled:opacity-40`}>
            Print
          </button>
          <button onClick={exportSummary} disabled={!summary} className={`${field} text-neutral-700 hover:bg-neutral-50 disabled:opacity-40`}>
            Export to Excel
          </button>
        </div>
      </div>

      {dateFilter}

      {summaryError && <p className="mt-4 text-sm text-red-600">{summaryError}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loadingSummary ? (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-neutral-400">Loading…</td>
              </tr>
            ) : !summary || summary.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-neutral-400">No open balances</td>
              </tr>
            ) : (
              summary.map((r) => (
                <tr key={r.customerId}>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => openDetail(r.customerId, r.name)} className="font-mono text-brand-blue hover:underline">
                      {formatPeso(r.balance)}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {summary && summary.length > 0 && (
            <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
              <tr>
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(summary.reduce((s, r) => s + r.balance, 0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </main>
  );
}
