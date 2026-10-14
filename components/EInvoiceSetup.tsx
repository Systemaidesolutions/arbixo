"use client";

import { useEffect, useState } from "react";

type Settings = { atpNumber: string; atpSeriesFrom: string; atpSeriesTo: string; atpValidUntil: string; nextInvoiceNo: number };
const EMPTY: Settings = { atpNumber: "", atpSeriesFrom: "", atpSeriesTo: "", atpValidUntil: "", nextInvoiceNo: 1 };

// Company-page section for this company's own Sales on Account e-invoicing
// (lib/salesInvoice.ts — "Create e-invoice" on a posted Sales document).
// Same shape as the platform's ARbixo business-profile ATP settings
// (Subscription > Business profile), scoped to this one company instead.
export function EInvoiceSetup({ editable }: { editable: boolean }) {
  const [s, setS] = useState<Settings>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/company/einvoice-setup")
      .then((r) => r.json())
      .then((j) => setS({ ...EMPTY, ...j }))
      .catch(() => {});
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((cur) => ({ ...cur, [k]: v }));
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/company/einvoice-setup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "E-invoice settings saved." } : { ok: false, text: data?.error ?? "Could not save." });
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <section className="mt-8">
      <h2 className="text-base font-medium text-neutral-900">E-invoice (Sales on Account)</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Lets you generate a BIR-style invoice for a posted Sales on Account document (the "Create
        e-invoice" button on the transaction). Fill in your Authority to Print below so it prints
        correctly in the invoice footer.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          ATP number
          <input value={s.atpNumber} onChange={(e) => set("atpNumber", e.target.value)} disabled={!editable} className={`${field} font-mono disabled:bg-neutral-50`} />
        </label>
        <label className={label}>
          Valid until
          <input type="date" value={s.atpValidUntil} onChange={(e) => set("atpValidUntil", e.target.value)} disabled={!editable} className={`${field} disabled:bg-neutral-50`} />
        </label>
        <label className={label}>
          Series from
          <input value={s.atpSeriesFrom} onChange={(e) => set("atpSeriesFrom", e.target.value)} disabled={!editable} className={`${field} font-mono disabled:bg-neutral-50`} />
        </label>
        <label className={label}>
          Series to
          <input value={s.atpSeriesTo} onChange={(e) => set("atpSeriesTo", e.target.value)} disabled={!editable} className={`${field} font-mono disabled:bg-neutral-50`} />
        </label>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        Next invoice generated will be numbered INV-{String(s.nextInvoiceNo).padStart(6, "0")}.
      </p>

      {editable && (
        <div className="mt-3 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
            {saving ? "Saving…" : "Save e-invoice settings"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      )}
    </section>
  );
}
