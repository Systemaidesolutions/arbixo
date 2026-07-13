"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { JournalType } from "@prisma/client";
import type { DocumentSummary } from "@/app/api/ledger-entries/route";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function TransactionSummary({
  companyId,
  journalType,
  documentNoLabel,
  counterpartyLabel = "Counterparty",
  refreshKey,
}: {
  companyId: string;
  journalType: JournalType;
  documentNoLabel: string;
  counterpartyLabel?: string;
  refreshKey: number;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [attachments, setAttachments] = useState<Record<string, { id: string; fileName: string }[]>>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(
      `/api/ledger-entries?companyId=${companyId}&journalType=${journalType}&month=${month}&year=${year}`
    );
    const data = await res.json();
    const docs: DocumentSummary[] = data.documents ?? [];
    setDocuments(docs);
    setLoading(false);
    if (docs.length) {
      const q = docs.map((d) => encodeURIComponent(d.documentNo)).join(",");
      const ar = await fetch(`/api/transactions/attachments?journalType=${journalType}&documentNos=${q}`);
      const aj = await ar.json().catch(() => ({}));
      setAttachments(aj.attachments ?? {});
    } else setAttachments({});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, refreshKey, journalType]);

  async function toggleCancel(doc: DocumentSummary) {
    await fetch("/api/ledger-entries/cancel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        journalType,
        documentNo: doc.documentNo,
        isCancelled: !doc.isCancelled,
      }),
    });
    load();
  }

  const field = "rounded border border-neutral-300 px-2 py-1 text-sm";

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-900">Transaction summary</h2>
        <div className="flex gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={field}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`${field} w-20`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">{documentNoLabel}</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">{counterpartyLabel}</th>
              <th className="px-3 py-2 text-left">Particulars</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-center">Files</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-neutral-400">
                  Loading…
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-neutral-400">
                  No entries for this month
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.documentNo} className={doc.isCancelled ? "opacity-40" : ""}>
                  <td className="px-3 py-2 font-mono">{doc.documentNo}</td>
                  <td className="px-3 py-2">{new Date(doc.postingDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{doc.counterpartyName ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500">{doc.particulars ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPeso(doc.totalDebit)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPeso(doc.totalCredit)}</td>
                  <td className="px-3 py-2 text-center">
                    {(attachments[doc.documentNo] ?? []).length === 0 ? (
                      <span className="text-neutral-300">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {attachments[doc.documentNo].map((a) => (
                          <a key={a.id} href={`/api/transactions/attachments/${a.id}`} download title={a.fileName} className="text-brand-blue hover:underline">📎</a>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleCancel(doc)}
                      className="text-xs text-neutral-400 hover:text-red-600"
                    >
                      {doc.isCancelled ? "Restore" : "Cancel"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
