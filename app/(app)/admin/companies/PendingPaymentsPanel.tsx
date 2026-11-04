"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pending = {
  id: string; app: "ACCOUNTING" | "PAYROLL"; month: string; priceName: string; amountDue: number; currency: string;
  gcashRef: string | null; receiptImage: string | null; createdByEmail: string | null; createdAt: string;
};

// Admin › company page: subscription payments this company submitted that
// wait for approval (Accounting and Payroll). Verify activates the month.
export function PendingPaymentsPanel({ payments }: { payments: Pending[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  if (payments.length === 0) return null;

  async function act(p: Pending, status: "VERIFIED" | "REJECTED") {
    if (status === "REJECTED" && !confirm("Reject this payment? Any voucher used is freed up again.")) return;
    setBusy(p.id);
    const res = await fetch(`/api/admin/subscription/payments/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) return alert((await res.json().catch(() => ({})))?.error ?? "Could not update.");
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-medium text-amber-900">Waiting for your approval ({payments.length})</h2>
      <p className="mt-1 text-xs text-amber-800">Check the reference or receipt, then Verify to activate the month, or Reject.</p>
      <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-amber-800">
          <tr><th className="py-1 pr-3 font-medium">Approve</th><th className="py-1 pr-3 font-medium">App</th><th className="py-1 pr-3 font-medium">Month</th><th className="py-1 pr-3 font-medium">Price</th><th className="py-1 pr-3 text-right font-medium">Amount</th><th className="py-1 pr-3 font-medium">Ref / receipt</th><th className="py-1 pr-3 font-medium">Submitted by</th></tr>
        </thead>
        <tbody className="divide-y divide-amber-100">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="py-1.5 pr-3">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <button onClick={() => act(p, "VERIFIED")} disabled={busy === p.id} className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Verify</button>
                  <button onClick={() => act(p, "REJECTED")} disabled={busy === p.id} className="text-xs text-red-600 hover:underline disabled:opacity-50">Reject</button>
                </div>
              </td>
              <td className="py-1.5 pr-3">{p.app === "PAYROLL" ? "Payroll" : "Accounting"}</td>
              <td className="py-1.5 pr-3">{p.month}</td>
              <td className="py-1.5 pr-3 text-xs">{p.priceName}</td>
              <td className="py-1.5 pr-3 text-right font-mono">{p.currency} {p.amountDue.toFixed(2)}</td>
              <td className="py-1.5 pr-3 text-xs">
                <span className="font-mono">{p.gcashRef || "—"}</span>
                {p.receiptImage && <button onClick={() => setZoom(p.receiptImage)} className="ml-2 text-brand-blue hover:underline">receipt</button>}
              </td>
              <td className="py-1.5 pr-3 text-xs">{p.createdByEmail ?? "—"}<div className="text-neutral-500">{p.createdAt.slice(0, 10)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Receipt" className="max-h-full max-w-full rounded shadow-2xl" />
        </div>
      )}
    </section>
  );
}
