"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tierFor, tierLadder } from "@/lib/payroll/subscriptionTiers";

type Month = { month: string; label: string; maxEmployees: number; amount: number; free: boolean };
type TierPrice = { maxEmployees: number; name: string; amount: number; currency: string };

// Admin › company page: the company's ARbixo Payroll subscription (separate
// from the Accounting one above). Months paid with their employee tier, and
// recording a month (paid at the tier's price, or as a free grant).
export function PayrollSubscriptionPanel({
  companyId, months, activeEmployees, prices, currentMonth,
}: {
  companyId: string;
  months: Month[];
  activeEmployees: number;
  prices: TierPrice[];
  currentMonth: string;
}) {
  const router = useRouter();
  const need = tierFor(Math.max(1, activeEmployees));
  const [month, setMonth] = useState(currentMonth);
  const [tier, setTier] = useState<number>(prices.find((p) => p.maxEmployees >= need)?.maxEmployees ?? need);
  const [free, setFree] = useState(prices.length === 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const thisMonth = months.find((m) => m.month === currentMonth);
  const badge = !thisMonth
    ? { text: "Not subscribed this month", cls: "bg-neutral-100 text-neutral-600" }
    : thisMonth.maxEmployees < activeEmployees
      ? { text: `Too many employees · tier ${thisMonth.maxEmployees}`, cls: "bg-red-100 text-red-700" }
      : { text: `Active · up to ${thisMonth.maxEmployees}`, cls: "bg-green-100 text-green-800" };
  const price = prices.find((p) => p.maxEmployees === tier);
  const tiers = [...new Set([...prices.map((p) => p.maxEmployees), ...tierLadder(Math.max(need, 1000))])].sort((a, b) => a - b);

  async function record() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/companies/${companyId}/payroll-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, maxEmployees: tier, free }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Could not record." });
    setMsg({ ok: true, text: `Recorded ARbixo Payroll for ${month}, up to ${tier} employees.` });
    router.refresh();
  }

  async function remove(m: Month) {
    if (!confirm(`Remove ARbixo Payroll for ${m.label}? Payroll runs for that month will lock again.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/companies/${companyId}/payroll-subscription?month=${m.month}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: "Could not remove." });
    setMsg({ ok: true, text: `Removed ${m.label}.` });
    router.refresh();
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-800">Payroll subscription</h2>
        <span className={`rounded px-2 py-0.5 text-xs ${badge.cls}`}>{badge.text}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        ARbixo Payroll is billed separately from Accounting, monthly by employee count. This company has{" "}
        <b>{activeEmployees}</b> active payroll employee(s), so it needs the <b>{need}</b>-employee tier. Payroll runs only work for the
        months listed here.
      </p>

      <div className="mt-3 overflow-hidden rounded border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr><th className="px-3 py-1.5 font-medium">Month</th><th className="px-3 py-1.5 font-medium">Employees</th><th className="px-3 py-1.5 text-right font-medium">Amount</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {months.length === 0 && <tr><td colSpan={4} className="px-3 py-2 text-neutral-400">No payroll months yet.</td></tr>}
            {months.map((m) => (
              <tr key={m.month}>
                <td className="px-3 py-1.5">{m.label}{m.month === currentMonth && <span className="ml-1 text-[10px] text-neutral-400">(this month)</span>}</td>
                <td className={`px-3 py-1.5 ${m.maxEmployees < activeEmployees ? "text-red-600" : ""}`}>Up to {m.maxEmployees}</td>
                <td className="px-3 py-1.5 text-right font-mono">{m.free ? "Free" : m.amount.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right"><button onClick={() => remove(m)} disabled={busy} className="text-xs text-red-600 hover:underline">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 items-end gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className={label}>
          Record a payment for month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Employees
          <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className={field}>
            {tiers.map((t) => {
              const p = prices.find((x) => x.maxEmployees === t);
              return <option key={t} value={t}>Up to {t}{p ? ` — ${p.currency} ${p.amount.toFixed(2)}` : " (no price)"}</option>;
            })}
          </select>
        </label>
        <button
          onClick={record}
          disabled={busy || !month || (!free && !price)}
          className="rounded border border-brand-green px-4 py-2 text-sm font-medium text-brand-green hover:bg-green-50 disabled:opacity-50"
        >
          {free ? "Grant month (free)" : price ? `Renew for month (${price.currency} ${price.amount.toFixed(2)})` : "Renew for month"}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />
        Free grant (₱0), e.g. a trial month
      </label>
      {!free && !price && <p className="mt-1 text-xs text-amber-600">No price for this tier yet. Add it under Subscription › Pricing › ARbixo Payroll, or tick Free grant.</p>}
      {tier < activeEmployees && <p className="mt-1 text-xs text-red-600">This tier is smaller than the company&apos;s {activeEmployees} active employees; its payroll runs would stay locked.</p>}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
    </section>
  );
}
