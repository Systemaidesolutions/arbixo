"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { subscriptionStatus, toDateInput } from "@/lib/subscription";

const STATE_LABEL: Record<string, { text: string; cls: string }> = {
  none: { text: "No subscription", cls: "bg-neutral-100 text-neutral-600" },
  active: { text: "Active", cls: "bg-green-100 text-green-700" },
  expiring: { text: "Expiring soon", cls: "bg-amber-100 text-amber-700" },
  expired: { text: "Expired", cls: "bg-red-100 text-red-700" },
};

export function SubscriptionPanel({
  companyId,
  initial,
}: {
  companyId: string;
  initial: {
    isActive: boolean;
    billingEmail: string | null;
    subscriptionStartedAt: string | null;
    subscriptionEndsAt: string | null;
  };
}) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(initial.isActive);
  const [billingEmail, setBillingEmail] = useState(initial.billingEmail ?? "");
  const [endsAt, setEndsAt] = useState(toDateInput(initial.subscriptionEndsAt));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = subscriptionStatus(endsAt || null);
  const badge = STATE_LABEL[status.state];

  async function patch(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save.");
      return null;
    }
    setMsg(successMsg);
    router.refresh();
    return res.json().catch(() => ({}));
  }

  async function save() {
    await patch({ billingEmail, subscriptionEndsAt: endsAt || null }, "Subscription saved.");
  }

  async function renew() {
    const data = await patch({ renewMonths: 1 }, "Renewed for 1 month.");
    if (data?.company?.subscriptionEndsAt) setEndsAt(toDateInput(data.company.subscriptionEndsAt));
  }

  async function toggleActive() {
    const next = !isActive;
    const data = await patch(
      { isActive: next },
      next ? "Company re-enabled." : "Company disabled — its users can no longer sign in."
    );
    if (data) setIsActive(next);
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-800">Subscription</h2>
        <span className={`rounded px-2 py-0.5 text-xs ${badge.cls}`}>
          {badge.text}
          {status.daysLeft !== null && status.state !== "expired" && ` · ${status.daysLeft}d left`}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={label}>
          Billing email (for renewal reminders)
          <input
            type="email"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            placeholder="billing@company.com"
            className={field}
          />
        </label>
        <label className={label}>
          Subscription ends
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={renew}
          disabled={busy}
          className="rounded border border-brand-green px-4 py-2 text-sm font-medium text-brand-green hover:bg-green-50 disabled:opacity-50"
        >
          Renew 1 month
        </button>
        {msg && <span className="text-xs text-green-600">{msg}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {/* Company sign-in control */}
      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
        <div>
          <div className="text-sm font-medium text-neutral-800">Company access</div>
          <div className="text-xs text-neutral-500">
            {isActive
              ? "Enabled — users can sign in (even if the subscription has lapsed)."
              : "Disabled — no user of this company can sign in."}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleActive}
          disabled={busy}
          role="switch"
          aria-checked={isActive}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            isActive ? "bg-brand-green" : "bg-red-400"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              isActive ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
