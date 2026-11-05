"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS, describeLoginHours, type LoginHours } from "@/lib/loginHours";

export function LoginHoursPanel({
  companyId,
  initial,
  usersWithout2fa,
}: {
  companyId: string;
  initial: LoginHours;
  usersWithout2fa: number;
}) {
  const router = useRouter();
  const [v, setV] = useState<LoginHours>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  function toggleDay(d: number) {
    setV((p) => ({
      ...p,
      loginDays: p.loginDays.includes(d) ? p.loginDays.filter((x) => x !== d) : [...p.loginDays, d].sort(),
    }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/companies/${companyId}/login-hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    }).catch(() => null);
    setSaving(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setMsg({ ok: false, text: data.error ?? "Could not save." });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  const time = "rounded border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-50 disabled:text-neutral-400";

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-neutral-800">Allowed login hours</div>
          <div className="text-xs text-neutral-500">
            {v.loginHoursEnabled
              ? `Users sign in normally ${describeLoginHours(v)}. Outside that, they must use two-factor authentication.`
              : "Off: users can sign in any time with just their password (or two-factor if they turned it on)."}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={v.loginHoursEnabled}
          aria-label="Allowed login hours"
          onClick={() => setV((p) => ({ ...p, loginHoursEnabled: !p.loginHoursEnabled }))}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            v.loginHoursEnabled ? "bg-brand-green" : "bg-neutral-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              v.loginHoursEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <fieldset disabled={!v.loginHoursEnabled} className="mt-3 space-y-3 disabled:opacity-60">
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
          <span className="text-xs text-neutral-500">From</span>
          <input type="time" value={v.loginStart} onChange={(e) => setV({ ...v, loginStart: e.target.value })} className={time} />
          <span className="text-xs text-neutral-500">to</span>
          <input type="time" value={v.loginEnd} onChange={(e) => setV({ ...v, loginEnd: e.target.value })} className={time} />
          <span className="text-xs text-neutral-400">Philippine time</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((d, i) => {
            const on = v.loginDays.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(i)}
                className={`rounded border px-2.5 py-1 text-xs font-medium ${
                  on ? "border-brand-navy bg-brand-navy text-white" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-neutral-400">
          An end time earlier than the start (for example 10:00 PM to 6:00 AM) runs past midnight.
        </p>
      </fieldset>

      {v.loginHoursEnabled && usersWithout2fa > 0 && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {usersWithout2fa} user{usersWithout2fa === 1 ? " has" : "s have"} not set up two-factor yet, so they won&apos;t be
          able to sign in outside these hours until they do (from My Profile).
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save login hours"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
