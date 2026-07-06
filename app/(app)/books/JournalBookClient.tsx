"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";

type Line = {
  id: string;
  postingDate: string;
  documentNo: string;
  accountCode: string;
  accountTitle: string;
  particulars: string | null;
  counterparty: string | null;
  debit: number;
  credit: number;
};
type Data = { label: string; lines: Line[]; totalDebit: number; totalCredit: number };

function monthDefaults() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`,
    to: now.toISOString().slice(0, 10),
  };
}

export function JournalBookClient({
  book,
  title,
  registeredName,
  partyLabel,
}: {
  book: string;
  title: string;
  registeredName: string;
  partyLabel: string;
}) {
  const def = useMemo(monthDefaults, []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/books/journal?book=${book}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => active && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [book, from, to]);

  function exportCsv() {
    if (!data) return;
    const headers = ["Date", "Doc No.", "Account code", "Account", "Particulars", partyLabel, "Debit", "Credit"];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const l of data.lines) {
      lines.push([l.postingDate.slice(0, 10), l.documentNo, l.accountCode, l.accountTitle, l.particulars ?? "", l.counterparty ?? "", l.debit.toFixed(2), l.credit.toFixed(2)].map(esc).join(","));
    }
    lines.push(["", "", "", "", "", "TOTAL", data.totalDebit.toFixed(2), data.totalCredit.toFixed(2)].map(esc).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">{title}</h1>
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
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Export CSV</button>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Print</button>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-400">Covering {from} to {to}.</p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.lines.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No entries in this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Doc No.</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Particulars</th>
                <th className="px-3 py-2">{partyLabel}</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-1.5 text-xs">{l.postingDate.slice(0, 10)}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{l.documentNo}</td>
                  <td className="px-3 py-1.5 text-xs">
                    <span className="font-mono text-neutral-400">{l.accountCode}</span> {l.accountTitle}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-1.5 text-xs text-neutral-500" title={l.particulars ?? ""}>{l.particulars ?? "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-neutral-600">{l.counterparty ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{l.debit ? formatPeso(l.debit) : ""}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{l.credit ? formatPeso(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 font-medium">
                <td className="px-3 py-2" colSpan={5}>TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totalDebit)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
