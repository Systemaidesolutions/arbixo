"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Actions bar for the transaction detail view: a Cancel button (reason +
// reversal) for users who can cancel, and a Print voucher button shown only
// for the journals that use a printable voucher.
export function TransactionActions({
  companyId,
  journalType,
  documentNo,
  isCancelled,
  canCancel,
  showPrint,
  show2307,
  placement = "top",
}: {
  companyId: string;
  journalType: string;
  documentNo: string;
  isCancelled: boolean;
  canCancel: boolean;
  showPrint: boolean;
  show2307?: boolean;
  placement?: "top" | "bottom";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function printVoucher() {
    window.open(`/transactions/voucher/${journalType}/${encodeURIComponent(documentNo)}?_embed=1`, "_blank");
  }

  function print2307() {
    window.open(`/transactions/2307/${journalType}/${encodeURIComponent(documentNo)}?_embed=1`, "_blank");
  }

  async function confirmCancel() {
    if (!reason.trim()) {
      setError("Please enter a cancellation reason.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ledger-entries/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, journalType, documentNo, reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not cancel this transaction.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  // Print actions sit in the top bar; the Cancel action sits at the bottom.
  if (placement === "top") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {showPrint && (
          <button
            type="button"
            onClick={printVoucher}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Print voucher
          </button>
        )}
        {show2307 && (
          <button
            type="button"
            onClick={print2307}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Print 2307
          </button>
        )}
      </div>
    );
  }

  if (isCancelled || !canCancel) return null;

  return (
    <div className="mt-8 flex justify-end border-t border-neutral-200 pt-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Cancel transaction
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 sm:p-8" onClick={() => !busy && setOpen(false)}>
          <div className="mt-16 w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-medium text-neutral-900">Cancel {documentNo}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              This posts a reversal transaction and marks this document as cancelled. It can&apos;t be undone.
            </p>
            <label className="mt-4 block text-xs text-neutral-500">
              Cancellation reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="Why is this transaction being cancelled?"
              />
            </label>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                Keep transaction
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={busy}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Cancelling…" : "Cancel transaction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
