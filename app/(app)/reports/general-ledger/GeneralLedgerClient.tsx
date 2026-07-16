"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { Account } from "@prisma/client";

type GeneralLedgerRow = {
  id: string;
  entryNo: number;
  postingDate: string;
  journalType: string;
  documentNo: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
};

function formatBalance(n: number) {
  return `${formatPeso(Math.abs(n))} ${n >= 0 ? "Dr" : "Cr"}`;
}

export function GeneralLedgerClient({ companyId, accounts }: { companyId: string; accounts: Account[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [endingBalance, setEndingBalance] = useState(0);
  const [rows, setRows] = useState<GeneralLedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ companyId, accountId, dateFrom, dateTo });
    const res = await fetch(`/api/reports/general-ledger?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load general ledger.");
      return;
    }
    setBeginningBalance(data.beginningBalance);
    setEndingBalance(data.endingBalance);
    setRows(data.rows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, dateFrom, dateTo]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const accountLabel = (() => { const a = accounts.find((x) => x.id === accountId); return a ? `${a.code} — ${a.title}` : ""; })();

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const out: (string | number)[][] = [
      ["General Ledger", accountLabel, `${dateFrom} to ${dateTo}`],
      [],
      ["Date", "Journal", "Doc no.", "Debit", "Credit", "Balance"],
      ["", "", "", "Beginning balance", "", "", beginningBalance.toFixed(2)],
      ...rows.map((r) => [r.postingDate.slice(0, 10), r.journalType.replaceAll("_", " "), r.documentNo, r.debit ? r.debit.toFixed(2) : "", r.credit ? r.credit.toFixed(2) : "", r.runningBalance.toFixed(2)]),
      ["", "", "", "Ending balance", "", "", endingBalance.toFixed(2)],
    ];
    const blob = new Blob(["﻿" + out.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `general-ledger_${dateFrom}_to_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-neutral-900">General ledger</h1>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.open(`/reports/general-ledger/print?accountId=${accountId}&dateFrom=${dateFrom}&dateTo=${dateTo}&_embed=1`, "_blank")} disabled={!accountId || loading} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Print</button>
          <button onClick={exportCsv} disabled={!accountId || loading} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">Export to Excel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Every posted line for one account, in order, with a running balance.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4">
        <label className="text-xs text-neutral-500">
          Account
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={`mt-1 block ${field}`}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Journal</th>
              <th className="px-3 py-2 text-left">Doc no.</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <tr className="bg-neutral-50/50">
              <td colSpan={5} className="px-3 py-2 text-xs font-medium text-neutral-500">
                Beginning balance
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-medium text-neutral-500">
                {formatBalance(beginningBalance)}
              </td>
            </tr>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-neutral-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-neutral-400">
                  No entries for this period
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{new Date(row.postingDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-neutral-500">{row.journalType.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 font-mono">{row.documentNo}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.debit > 0 ? formatPeso(row.debit) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.credit > 0 ? formatPeso(row.credit) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatBalance(row.runningBalance)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
            <tr>
              <td colSpan={5} className="px-3 py-2">
                Ending balance
              </td>
              <td className="px-3 py-2 text-right font-mono">{formatBalance(endingBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}
