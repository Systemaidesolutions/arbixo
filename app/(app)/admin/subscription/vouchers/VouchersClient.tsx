"use client";

import { useEffect, useState } from "react";

type Voucher = {
  id: string;
  code: string;
  discountType: "FIXED" | "PERCENT";
  discountValue: string;
  isActive: boolean;
  redeemedAt: string | null;
  redeemedByCompanyId: string | null;
  batchId: string | null;
  note: string | null;
  createdAt: string;
};

function statusOf(v: Voucher): "active" | "redeemed" | "disabled" {
  if (v.redeemedAt) return "redeemed";
  if (!v.isActive) return "disabled";
  return "active";
}
const BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  redeemed: "bg-sky-100 text-sky-800",
  disabled: "bg-neutral-100 text-neutral-500",
};

export function VouchersClient() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [count, setCount] = useState("1");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCodes, setLastCodes] = useState<string[]>([]);

  async function refresh() {
    const res = await fetch("/api/admin/subscription/vouchers");
    const data = await res.json();
    setVouchers(data.vouchers ?? []);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastCodes([]);
    const res = await fetch("/api/admin/subscription/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: Number(count), discountType, discountValue: Number(discountValue), note }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Could not generate.");
      return;
    }
    setLastCodes(data.codes ?? []);
    setDiscountValue("");
    setNote("");
    refresh();
  }

  async function toggle(v: Voucher) {
    const res = await fetch(`/api/admin/subscription/vouchers/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    if (res.ok) refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";
  const fmtDisc = (v: Voucher) =>
    v.discountType === "PERCENT" ? `${Number(v.discountValue)}%` : Number(v.discountValue).toFixed(2);

  return (
    <div className="mt-6 space-y-8">
      <form onSubmit={generate} className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Generate vouchers</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Codes are random and single-use. Set the quantity to 1 for a single voucher, or higher for a
          batch.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className={label}>
            Quantity
            <input required type="number" min="1" max="500" value={count} onChange={(e) => setCount(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Discount type
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENT")} className={field}>
              <option value="FIXED">Fixed amount</option>
              <option value="PERCENT">Percentage</option>
            </select>
          </label>
          <label className={label}>
            {discountType === "PERCENT" ? "Percent off" : "Amount off"}
            <input required type="number" step="0.01" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Promo Q1" className={field} />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="mt-3 rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
          {busy ? "Generating…" : "Generate"}
        </button>

        {lastCodes.length > 0 && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-green-800">Generated {lastCodes.length} voucher(s):</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(lastCodes.join("\n"))}
                className="text-xs text-green-700 hover:underline"
              >
                Copy all
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs text-green-900">
              {lastCodes.map((c) => (
                <span key={c} className="rounded bg-white px-2 py-1 ring-1 ring-green-200">{c}</span>
              ))}
            </div>
          </div>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2 text-right">Discount</th>
              <th className="px-4 py-2">Note</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {vouchers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-3 text-neutral-400">No vouchers yet.</td></tr>
            ) : (
              vouchers.map((v) => {
                const s = statusOf(v);
                return (
                  <tr key={v.id}>
                    <td className="px-4 py-2 font-mono">{v.code}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDisc(v)}</td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{v.note || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[s]}`}>{s}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{v.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-2 text-right">
                      {!v.redeemedAt && (
                        <button onClick={() => toggle(v)} className="text-xs text-brand-blue hover:underline">
                          {v.isActive ? "Disable" : "Enable"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
