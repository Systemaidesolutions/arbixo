"use client";

import { useEffect, useState } from "react";

type Payment = {
  id: string;
  companyId: string;
  priceName: string;
  baseAmount: string;
  currency: string;
  voucherCode: string | null;
  discountAmount: string;
  amountDue: string;
  gcashRef: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  periodEnd: string | null;
  createdByEmail: string | null;
  createdAt: string;
  company: { tradeName: string; registeredName: string | null };
};

const BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
};

export function PaymentsClient() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/subscription/payments");
    const data = await res.json();
    setIsAdmin(!!data.isAdmin);
    setPayments(data.payments ?? []);
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function act(p: Payment, status: "VERIFIED" | "REJECTED") {
    if (status === "REJECTED" && !window.confirm("Reject this payment? Any voucher used is freed up again.")) return;
    setBusy(p.id);
    const res = await fetch(`/api/admin/subscription/payments/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (res.ok) refresh();
    else window.alert((await res.json().catch(() => ({})))?.error ?? "Could not update.");
  }

  const money = (p: Payment, v: string) => `${p.currency} ${Number(v).toFixed(2)}`;

  if (loading) return <p className="mt-6 text-sm text-neutral-400">Loading…</p>;

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2">Date</th>
            {isAdmin && <th className="px-3 py-2">Company</th>}
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Voucher</th>
            <th className="px-3 py-2 text-right">Discount</th>
            <th className="px-3 py-2 text-right">Amount due</th>
            <th className="px-3 py-2">GCash ref</th>
            <th className="px-3 py-2">Status</th>
            {isAdmin && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {payments.length === 0 ? (
            <tr><td colSpan={isAdmin ? 9 : 7} className="px-3 py-3 text-neutral-400">No payments yet.</td></tr>
          ) : (
            payments.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-1.5 text-xs">{p.createdAt.slice(0, 10)}</td>
                {isAdmin && <td className="px-3 py-1.5">{p.company.tradeName}</td>}
                <td className="px-3 py-1.5 text-xs">{p.priceName} <span className="text-neutral-400">({money(p, p.baseAmount)})</span></td>
                <td className="px-3 py-1.5 font-mono text-xs">{p.voucherCode ?? "—"}</td>
                <td className="px-3 py-1.5 text-right font-mono">{Number(p.discountAmount) > 0 ? money(p, p.discountAmount) : "—"}</td>
                <td className="px-3 py-1.5 text-right font-mono font-medium">{money(p, p.amountDue)}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{p.gcashRef || "—"}</td>
                <td className="px-3 py-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[p.status]}`}>{p.status.toLowerCase()}</span>
                </td>
                {isAdmin && (
                  <td className="px-3 py-1.5 text-right">
                    {p.status === "PENDING" && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => act(p, "VERIFIED")} disabled={busy === p.id} className="text-xs font-medium text-green-700 hover:underline disabled:opacity-50">Verify</button>
                        <button onClick={() => act(p, "REJECTED")} disabled={busy === p.id} className="text-xs text-red-600 hover:underline disabled:opacity-50">Reject</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
