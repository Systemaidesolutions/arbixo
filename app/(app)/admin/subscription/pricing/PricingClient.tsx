"use client";

import { useEffect, useState } from "react";

type Price = {
  id: string;
  name: string;
  amount: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

function statusOf(p: Price): "current" | "upcoming" | "expired" {
  const now = Date.now();
  const from = new Date(p.effectiveFrom).getTime();
  const to = p.effectiveTo ? new Date(p.effectiveTo).getTime() : null;
  if (from > now) return "upcoming";
  if (to !== null && to < now) return "expired";
  return "current";
}

const BADGE: Record<string, string> = {
  current: "bg-green-100 text-green-800",
  upcoming: "bg-amber-100 text-amber-800",
  expired: "bg-neutral-100 text-neutral-500",
};

export function PricingClient() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/subscription/prices");
    const data = await res.json();
    setPrices(data.prices ?? []);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function addPrice(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/subscription/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount: Number(amount), currency, effectiveFrom }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not add price.");
      return;
    }
    setName("");
    setAmount("");
    refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <div className="mt-6 space-y-8">
      <form onSubmit={addPrice} className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Add a price</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Adding a new price automatically closes the currently active one — the newest price whose
          date has arrived becomes current.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className={label}>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Price A" className={field} />
          </label>
          <label className={label}>
            Amount
            <input required type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Currency
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={`${field} uppercase`} />
          </label>
          <label className={label}>
            Effective from
            <input required type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={field} />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="mt-3 rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
          {saving ? "Saving…" : "Add price"}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Effective from</th>
              <th className="px-4 py-2">Effective to</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {prices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-3 text-neutral-400">No prices yet.</td></tr>
            ) : (
              prices.map((p) => {
                const s = statusOf(p);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium text-neutral-800">{p.name}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {p.currency} {Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2">{p.effectiveFrom.slice(0, 10)}</td>
                    <td className="px-4 py-2">{p.effectiveTo ? p.effectiveTo.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[s]}`}>{s}</span>
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
