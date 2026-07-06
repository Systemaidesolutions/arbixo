"use client";

import { useEffect, useState } from "react";

export function GcashClient() {
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/subscription/gcash")
      .then((r) => r.json())
      .then((j) => {
        setGcashName(j.gcashName ?? "");
        setGcashNumber(j.gcashNumber ?? "");
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/subscription/gcash", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gcashName, gcashNumber }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "GCash account saved." } : { ok: false, text: data?.error ?? "Could not save." });
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <form onSubmit={save} className="mt-6 max-w-md space-y-4 rounded-lg border border-neutral-200 p-4">
      <label className={label}>
        Account name
        <input value={gcashName} onChange={(e) => setGcashName(e.target.value)} placeholder="Juan Dela Cruz" className={field} />
      </label>
      <label className={label}>
        GCash mobile number
        <input value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value)} placeholder="09171234567" inputMode="numeric" className={`${field} font-mono`} />
      </label>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <button type="submit" disabled={saving} className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
        {saving ? "Saving…" : "Save GCash account"}
      </button>
    </form>
  );
}
