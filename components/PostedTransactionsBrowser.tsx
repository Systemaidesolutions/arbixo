"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";
import { usePageStack } from "@/components/PageStack";

type Doc = {
  documentNo: string;
  postingDate: string;
  particulars: string | null;
  counterpartyName: string | null;
  totalDebit: number;
  totalCredit: number;
  totalNet: number;
  totalVat: number;
  totalWithholding: number;
  isCancelled: boolean;
  lineCount: number;
  checkNo: string | null;
};

// Full-page browser of a journal's posted documents. Same columns as the
// transaction-search popup, with in-page filters (date range + free text).
// A blank filter shows every record.
export function PostedTransactionsBrowser({
  companyId,
  journalType,
  title,
  description,
}: {
  companyId: string;
  journalType: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const ps = usePageStack();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<Doc[]>([]);
  const [files, setFiles] = useState<Record<string, { id: string; fileName: string }[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ companyId, journalType });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debounced) params.set("q", debounced);
    fetch(`/api/ledger-entries/search?${params.toString()}`)
      .then((r) => r.json())
      .then(async (j) => {
        if (!active) return;
        const docs: Doc[] = j.documents ?? [];
        setRows(docs);
        if (docs.length) {
          const docNos = docs.map((d) => d.documentNo).join(",");
          const ar = await fetch(`/api/transactions/attachments?journalType=${journalType}&documentNos=${encodeURIComponent(docNos)}`);
          const aj = await ar.json().catch(() => ({ attachments: {} }));
          if (active) setFiles(aj.attachments ?? {});
        } else if (active) {
          setFiles({});
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [companyId, journalType, from, to, debounced]);

  function exportExcel() {
    const params = new URLSearchParams({ companyId, journalType });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debounced) params.set("q", debounced);
    window.open(`/api/ledger-entries/export?${params.toString()}`, "_blank");
  }

  // Open the transaction detail chrome-less (as a stacked page), rather than
  // navigating inside the History iframe which would show the full app nav.
  const openDoc = (docNo: string) => {
    const href = `/transactions/view/${journalType}/${encodeURIComponent(docNo)}`;
    if (ps) ps.open(href, docNo);
    else if (typeof window !== "undefined" && window.parent !== window)
      window.parent.postMessage({ type: "stack:open", href, title: docNo }, window.location.origin);
    else router.push(href);
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4">
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
            placeholder="Doc no., party, particulars, ref"
            className={`mt-1 block w-64 ${field}`}
          />
        </label>
        <div className="ml-auto flex items-end gap-2">
          {(from || to || debounced) && (
            <button
              onClick={() => { setFrom(""); setTo(""); setSearch(""); }}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Clear
            </button>
          )}
          <button
            onClick={exportExcel}
            disabled={loading || rows.length === 0}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Export to Excel
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-500">{loading ? "Loading…" : `${rows.length} transaction${rows.length === 1 ? "" : "s"}`}</p>

      <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2">Doc no.</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Party</th>
              <th className="px-3 py-2">Particulars</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-right">VAT</th>
              <th className="px-3 py-2 text-right">W/tax</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Files</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {!loading && rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-neutral-400">No transactions found.</td></tr>
            ) : (
              rows.map((d) => (
                <tr key={d.documentNo} onClick={() => openDoc(d.documentNo)} className="cursor-pointer hover:bg-blue-50">
                  <td className="px-3 py-1.5 font-mono text-xs">{d.documentNo}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs">{fmtDate(d.postingDate)}</td>
                  <td className="px-3 py-1.5 text-xs text-neutral-600">{d.counterpartyName ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 text-xs text-neutral-500" title={d.particulars ?? ""}>{d.particulars ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(d.totalNet)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(d.totalVat)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(d.totalWithholding)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPeso(Math.max(d.totalDebit, d.totalCredit))}</td>
                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    {(files[d.documentNo] ?? []).length === 0 ? (
                      <span className="text-neutral-300">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {files[d.documentNo].map((f) => (
                          <a key={f.id} href={`/api/transactions/attachments/${f.id}`} download title={f.fileName} className="text-brand-blue hover:underline">📎</a>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {d.isCancelled ? <span className="text-red-500">Cancelled</span> : <span className="text-neutral-400">Posted</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
