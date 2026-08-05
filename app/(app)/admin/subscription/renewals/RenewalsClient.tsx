"use client";

import { Fragment, useEffect, useState } from "react";

type Company = { id: string; tradeName: string; registeredName: string | null; subscriptionEndsAt: string | null };
type Data = {
  companies: Company[];
  price: { name: string; amount: number; currency: string } | null;
  gcash: { name: string; number: string; qrImage: string | null };
};

function status(endsAt: string | null): { label: string; cls: string } {
  if (!endsAt) return { label: "none", cls: "bg-neutral-100 text-neutral-500" };
  const days = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "expired", cls: "bg-red-100 text-red-700" };
  if (days <= 7) return { label: `${days}d left`, cls: "bg-amber-100 text-amber-800" };
  return { label: "active", cls: "bg-green-100 text-green-800" };
}

// yyyy-mm for <input type="month">, defaulting to the calendar month
// containing endsAt (periodEnd for a month-aligned payment lands exactly on
// the 1st of the next uncovered month, so this is "the next month to renew"
// in the common case), or the current month if there's no subscription yet.
function defaultMonth(endsAt: string | null): string {
  const d = endsAt ? new Date(endsAt) : new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function RenewalsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const [voucher, setVoucher] = useState("");
  const [gcashRef, setGcashRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowMsg, setRowMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const [bulkMonth, setBulkMonth] = useState(defaultMonth(null));
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/subscription/renewals");
    setData(await res.json());
  }
  useEffect(() => {
    refresh();
  }, []);

  function toggle(id: string, endsAt: string | null) {
    setOpenId((cur) => (cur === id ? null : id));
    setMonth(defaultMonth(endsAt));
    setVoucher("");
    setGcashRef("");
    setRowMsg(null);
  }

  async function cancel(companyId: string, name: string) {
    if (!window.confirm(`Cancel the subscription for "${name}"? It will read as no subscription. You can renew again anytime.`)) return;
    const res = await fetch("/api/admin/subscription/renewals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, action: "cancel" }),
    });
    if (res.ok) {
      setData((d) => (d ? { ...d, companies: d.companies.map((c) => (c.id === companyId ? { ...c, subscriptionEndsAt: null } : c)) } : d));
      setOpenId((cur) => (cur === companyId ? null : cur));
    } else {
      window.alert((await res.json().catch(() => ({})))?.error ?? "Could not cancel.");
    }
  }

  async function renew(companyId: string) {
    if (!month) {
      setRowMsg({ id: companyId, ok: false, text: "Pick a month first." });
      return;
    }
    setBusy(true);
    setRowMsg(null);
    const res = await fetch("/api/admin/subscription/renewals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, month, voucherCode: voucher.trim(), gcashRef }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setRowMsg({ id: companyId, ok: false, text: j?.error ?? "Could not renew." });
      return;
    }
    setRowMsg({ id: companyId, ok: true, text: `Recorded — now covered through ${String(j.subscriptionEndsAt).slice(0, 10)}.` });
    setData((d) =>
      d ? { ...d, companies: d.companies.map((c) => (c.id === companyId ? { ...c, subscriptionEndsAt: j.subscriptionEndsAt } : c)) } : d
    );
    setOpenId(null);
  }

  async function applyToAll() {
    if (!data || !bulkMonth) return;
    const label = new Date(`${bulkMonth}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    if (
      !window.confirm(
        `Mark ${label} as paid for all ${data.companies.length} companies? This creates a $0 administrative grant for each — not a real GCash payment.`
      )
    )
      return;
    setBulkBusy(true);
    setBulkMsg(null);
    const res = await fetch("/api/admin/subscription/bulk-renew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: bulkMonth }),
    });
    const j = await res.json().catch(() => ({}));
    setBulkBusy(false);
    if (!res.ok) {
      setBulkMsg({ ok: false, text: j?.error ?? "Could not apply to all companies." });
      return;
    }
    setBulkMsg({ ok: true, text: `${label} applied to ${j.updated} company(ies).` });
    refresh();
  }

  if (!data) return <p className="mt-6 text-sm text-neutral-400">Loading…</p>;

  const price = data.price;
  const cur = price?.currency ?? "PHP";
  const fmt = (n: number) => `${cur} ${n.toFixed(2)}`;

  return (
    <div className="mt-6">
      {!price && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No current subscription price is set. Add one under Subscription → Pricing before renewing.
        </p>
      )}

      {/* Bulk: mark one month paid for every company at once. */}
      <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
        <div className="text-sm font-medium text-neutral-800">Apply a month to all companies</div>
        <p className="mt-1 text-xs text-neutral-500">
          Marks the chosen month as covered for every company as a $0 administrative grant — for platform-wide grants or
          promotions, not for recording a real payment. Use the per-company Renew below for that.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={bulkMonth}
            onChange={(e) => setBulkMonth(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <button
            onClick={applyToAll}
            disabled={bulkBusy || !bulkMonth}
            className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
          >
            {bulkBusy ? "Applying…" : "Apply to all companies"}
          </button>
          {bulkMsg && <span className={`text-xs ${bulkMsg.ok ? "text-green-600" : "text-red-600"}`}>{bulkMsg.text}</span>}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Subscription ends</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.companies.map((c) => {
              const st = status(c.subscriptionEndsAt);
              const isOpen = openId === c.id;
              return (
                <Fragment key={c.id}>
                  <tr>
                    <td className="px-4 py-2 font-medium text-neutral-800">{c.tradeName}</td>
                    <td className="px-4 py-2">{c.subscriptionEndsAt ? c.subscriptionEndsAt.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {c.subscriptionEndsAt && (
                          <button onClick={() => cancel(c.id, c.tradeName)} className="text-xs text-red-600 hover:underline">
                            Cancel
                          </button>
                        )}
                        <button onClick={() => toggle(c.id, c.subscriptionEndsAt)} disabled={!price} className="text-xs font-medium text-brand-blue hover:underline disabled:opacity-40">
                          {isOpen ? "Close" : "Renew"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && price && (
                    <tr className="bg-neutral-50/60">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-3">
                            <div className="text-sm">
                              Renewing <span className="font-medium">{c.tradeName}</span> — {price.name} <span className="font-mono">{fmt(price.amount)}</span> for the month below.
                            </div>
                            <label className="block text-xs text-neutral-500">
                              Month to record payment for
                              <input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="block text-xs text-neutral-500">
                              Voucher code (optional)
                              <input value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase())} placeholder="Enter code" className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm uppercase" />
                            </label>
                            <label className="block text-xs text-neutral-500">
                              GCash reference no. (optional)
                              <input value={gcashRef} onChange={(e) => setGcashRef(e.target.value)} placeholder="If paid via GCash" className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm" />
                            </label>
                            <button onClick={() => renew(c.id)} disabled={busy} className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
                              {busy ? "Recording…" : "Confirm renewal"}
                            </button>
                            {rowMsg?.id === c.id && <p className={`text-xs ${rowMsg.ok ? "text-green-600" : "text-red-600"}`}>{rowMsg.text}</p>}
                          </div>
                          {(data.gcash.qrImage || data.gcash.number) && (
                            <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-white p-3 ring-1 ring-neutral-200">
                              {data.gcash.qrImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={data.gcash.qrImage} alt="GCash QR" className="h-36 w-36 object-contain" />
                              )}
                              <div className="text-center text-xs">
                                <div className="font-medium text-neutral-700">{data.gcash.name || "GCash"}</div>
                                {data.gcash.number && <div className="font-mono text-neutral-500">{data.gcash.number}</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
