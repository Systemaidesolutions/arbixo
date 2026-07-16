"use client";

import { useState } from "react";
import { formatPeso } from "@/lib/format";

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

// Search box + floating results page for a journal's posted documents.
// Sits beside "Import from Excel"; hitting Enter opens an overlay listing
// the matches, each of which opens its voucher in a new tab.
export function TransactionSearch({
  companyId,
  journalType,
  title = "Search results",
}: {
  companyId: string;
  journalType: string;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Doc[]>([]);
  const [searched, setSearched] = useState("");
  const [files, setFiles] = useState<Record<string, { id: string; fileName: string }[]>>({});

  async function run() {
    const term = q.trim();
    if (!term) return; // blank search does nothing — use the History pages to browse all
    setOpen(true);
    setLoading(true);
    setSearched(term);
    try {
      const res = await fetch(
        `/api/ledger-entries/search?companyId=${companyId}&journalType=${journalType}&q=${encodeURIComponent(term)}`
      );
      const data = await res.json().catch(() => ({ documents: [] }));
      const docs: Doc[] = data.documents ?? [];
      setResults(docs);
      if (docs.length) {
        const docNos = docs.map((d) => d.documentNo).join(",");
        const ar = await fetch(`/api/transactions/attachments?journalType=${journalType}&documentNos=${encodeURIComponent(docNos)}`);
        const aj = await ar.json().catch(() => ({ attachments: {} }));
        setFiles(aj.attachments ?? {});
      } else {
        setFiles({});
      }
    } catch {
      setResults([]);
      setFiles({});
    } finally {
      setLoading(false);
    }
  }

  function openDocument(docNo: string) {
    window.open(`/transactions/view/${journalType}/${encodeURIComponent(docNo)}?_embed=1`, "_blank");
  }

  function exportExcel() {
    const params = new URLSearchParams({ companyId, journalType });
    if (searched) params.set("q", searched);
    window.open(`/api/ledger-entries/export?${params.toString()}`, "_blank");
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  return (
    <>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder="Search transactions…"
          className="w-48 rounded border border-neutral-300 py-1.5 pl-8 pr-2 text-sm placeholder:text-neutral-400 focus:w-64 focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="mt-8 flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-medium text-neutral-900">{title}</h2>
                <p className="text-xs text-neutral-500">
                  {loading
                    ? "Searching…"
                    : searched
                      ? `${results.length} match${results.length === 1 ? "" : "es"} for “${searched}”`
                      : `${results.length} transaction${results.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={loading || results.length === 0}
                  className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                >
                  Export to Excel
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              {!loading && results.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">No transactions found.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Doc no.</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Party</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2 text-right">VAT</th>
                      <th className="px-3 py-2 text-right">W/tax</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((d) => (
                      <tr
                        key={d.documentNo}
                        onClick={() => openDocument(d.documentNo)}
                        className="cursor-pointer border-b border-neutral-100 hover:bg-blue-50"
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {d.documentNo}
                          {d.isCancelled && <span className="ml-1 text-red-500">(cancelled)</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(d.postingDate)}</td>
                        <td className="px-3 py-2">{d.counterpartyName ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPeso(d.totalNet)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPeso(d.totalVat)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPeso(d.totalWithholding)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatPeso(Math.max(d.totalDebit, d.totalCredit))}
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          {(files[d.documentNo] ?? []).length === 0 ? (
                            <span className="text-neutral-300">—</span>
                          ) : (
                            <span className="flex flex-wrap gap-1.5">
                              {files[d.documentNo].map((f) => (
                                <a
                                  key={f.id}
                                  href={`/api/transactions/attachments/${f.id}`}
                                  download
                                  title={f.fileName}
                                  className="text-brand-blue hover:underline"
                                >
                                  📎
                                </a>
                              ))}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-neutral-200 px-4 py-2 text-right text-[11px] text-neutral-400">
              Click a row to open the transaction
            </div>
          </div>
        </div>
      )}
    </>
  );
}
