"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { JournalType } from "@prisma/client";

const JOURNAL_LABELS: Record<JournalType, string> = {
  CASH_DISBURSEMENT: "Cash Disbursement",
  CASH_RECEIPT: "Cash Receipt",
  SALES_ON_ACCOUNT: "Sales on Account",
  PURCHASE_ON_ACCOUNT: "Purchase on Account",
  GENERAL_JOURNAL: "General Journal",
};

type Row = {
  id: string;
  entryNo: number;
  postingDate: string;
  journalType: JournalType;
  documentNo: string;
  accountCode: string;
  accountTitle: string;
  counterparty: string | null;
  description: string | null;
  debit: number;
  credit: number;
};
type Data = { rows: Row[]; total: number; totalDebit: number; totalCredit: number; page: number; pageSize: number };

export function LedgerEntriesBrowser({
  kind,
  title,
  description,
}: {
  kind: "sales" | "purchase" | "all";
  title: string;
  description: string;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce the free-text search so we don't fetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever the filters change.
  useEffect(() => setPage(1), [from, to, debounced]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ kind, page: String(page) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debounced) params.set("q", debounced);
    fetch(`/api/history/ledger-entries?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setData(j);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [kind, from, to, debounced, page]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Doc no., account, particulars"
            className={`mt-1 block w-56 ${field}`}
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Print
          </button>
        </div>
      </div>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No entries match these filters.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Entry</th>
                  <th className="px-3 py-2">Journal</th>
                  <th className="px-3 py-2">Doc No.</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Counterparty</th>
                  <th className="px-3 py-2">Particulars</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5 text-xs">{r.postingDate.slice(0, 10)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-neutral-400">{r.entryNo}</td>
                    <td className="px-3 py-1.5 text-xs">{JOURNAL_LABELS[r.journalType]}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.documentNo}</td>
                    <td className="px-3 py-1.5 text-xs">
                      <span className="font-mono text-neutral-400">{r.accountCode}</span> {r.accountTitle}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-neutral-600">{r.counterparty ?? "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-1.5 text-xs text-neutral-500" title={r.description ?? ""}>
                      {r.description ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.debit ? formatPeso(r.debit) : ""}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.credit ? formatPeso(r.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-50 font-medium">
                  <td className="px-3 py-2" colSpan={7}>Total (all filtered entries)</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totalDebit)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPeso(data.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-neutral-500 print:hidden">
            <span>{data.total.toLocaleString()} entries</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-neutral-300 px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span>Page {data.page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded border border-neutral-300 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
