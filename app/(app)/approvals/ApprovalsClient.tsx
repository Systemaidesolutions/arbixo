"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalType } from "@prisma/client";

export type PendingDoc = {
  journalType: JournalType;
  documentNo: string;
  postingDate: string;
  total: number;
  lines: number;
  postedBy: string | null;
};

const JOURNAL_LABELS: Record<JournalType, string> = {
  CASH_DISBURSEMENT: "Cash Disbursement",
  CASH_RECEIPT: "Cash Receipt",
  SALES_ON_ACCOUNT: "Sales on Account",
  PURCHASE_ON_ACCOUNT: "Purchase Journal",
  GENERAL_JOURNAL: "General Journal",
};

function peso(n: number): string {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ApprovalsClient({ companyId, docs }: { companyId: string; docs: PendingDoc[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(doc: PendingDoc) {
    const key = `${doc.journalType}|${doc.documentNo}`;
    setBusy(key);
    setError(null);
    const res = await fetch("/api/ledger-entries/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, journalType: doc.journalType, documentNo: doc.documentNo }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not approve.");
      return;
    }
    router.refresh();
  }

  if (docs.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
        Nothing pending — all transactions have been reviewed. ✓
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Journal</th>
              <th className="px-3 py-2 text-left">Doc No.</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Posted by</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {docs.map((d) => {
              const key = `${d.journalType}|${d.documentNo}`;
              return (
                <tr key={key}>
                  <td className="px-3 py-2 text-neutral-700">{JOURNAL_LABELS[d.journalType]}</td>
                  <td className="px-3 py-2 font-mono text-neutral-700">{d.documentNo}</td>
                  <td className="px-3 py-2 text-neutral-500">{d.postingDate}</td>
                  <td className="px-3 py-2 text-right text-neutral-700">{peso(d.total)}</td>
                  <td className="px-3 py-2 text-neutral-500">{d.postedBy ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => approve(d)}
                      disabled={busy === key}
                      className="rounded border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-40"
                    >
                      {busy === key ? "Approving…" : "Approve"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
