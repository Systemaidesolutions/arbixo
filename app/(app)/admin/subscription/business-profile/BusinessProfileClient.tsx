"use client";

import { useEffect, useState } from "react";

type Profile = {
  registeredName: string;
  tradeName: string;
  tin: string;
  taxpayerClass: string;
  address: string;
  rdoCode: string;
  periodType: string;
  registrationType: string;
  businessType: string;
  lineOfBusiness: string;
  telephone: string;
  atpNumber: string;
  atpSeriesFrom: string;
  atpSeriesTo: string;
  atpValidUntil: string;
};

const EMPTY: Profile = {
  registeredName: "",
  tradeName: "",
  tin: "",
  taxpayerClass: "",
  address: "",
  rdoCode: "",
  periodType: "",
  registrationType: "",
  businessType: "",
  lineOfBusiness: "",
  telephone: "",
  atpNumber: "",
  atpSeriesFrom: "",
  atpSeriesTo: "",
  atpValidUntil: "",
};

export function BusinessProfileClient() {
  const [p, setP] = useState<Profile>(EMPTY);
  const [nextInvoiceNo, setNextInvoiceNo] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/subscription/business-profile")
      .then((r) => r.json())
      .then((j) => {
        setP({ ...EMPTY, ...j });
        setNextInvoiceNo(j.nextInvoiceNo ?? null);
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof Profile>(k: K, v: string) {
    setP((cur) => ({ ...cur, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/subscription/business-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Business profile saved." } : { ok: false, text: data?.error ?? "Could not save." });
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <form onSubmit={save} className="mt-6 max-w-2xl space-y-6">
      <div className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-800">BIR registration</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            Trade name
            <input value={p.tradeName} onChange={(e) => set("tradeName", e.target.value)} placeholder="ARbixo" className={field} />
          </label>
          <label className={label}>
            Registered name
            <input value={p.registeredName} onChange={(e) => set("registeredName", e.target.value)} placeholder="Systemaide Solutions Inc." className={field} />
          </label>
          <label className={label}>
            TIN
            <input value={p.tin} onChange={(e) => set("tin", e.target.value)} placeholder="123-456-789-00000" className={`${field} font-mono`} />
          </label>
          <label className={label}>
            Taxpayer classification
            <input value={p.taxpayerClass} onChange={(e) => set("taxpayerClass", e.target.value)} placeholder="Non-Individual (Partnership, Corporation, etc.)" className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Business address
            <textarea value={p.address} onChange={(e) => set("address", e.target.value)} rows={2} className={field} />
          </label>
          <label className={label}>
            RDO code
            <input value={p.rdoCode} onChange={(e) => set("rdoCode", e.target.value)} placeholder="54B — Kawit, West Cavite" className={field} />
          </label>
          <label className={label}>
            Period type
            <input value={p.periodType} onChange={(e) => set("periodType", e.target.value)} placeholder="Calendar" className={field} />
          </label>
          <label className={label}>
            Registration type
            <input value={p.registrationType} onChange={(e) => set("registrationType", e.target.value)} placeholder="VAT Registered" className={field} />
          </label>
          <label className={label}>
            Business type
            <input value={p.businessType} onChange={(e) => set("businessType", e.target.value)} placeholder="Corporation" className={field} />
          </label>
          <label className={label}>
            Line of business
            <input value={p.lineOfBusiness} onChange={(e) => set("lineOfBusiness", e.target.value)} placeholder="IT Solutions" className={field} />
          </label>
          <label className={label}>
            Telephone
            <input value={p.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="09175373111" className={field} />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-800">Authority to Print (ATP)</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Printed in the invoice footer as BIR requires. An app-generated invoice is a convenience/record
          copy of the number series your ATP covers — it doesn&apos;t by itself replace a Permit to Use for
          system-generated invoices, so keep issuing your physical ATP invoice as the official document
          until/unless you register a loose-leaf or CAS permit for this system.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            ATP number
            <input value={p.atpNumber} onChange={(e) => set("atpNumber", e.target.value)} className={`${field} font-mono`} />
          </label>
          <label className={label}>
            Valid until
            <input type="date" value={p.atpValidUntil} onChange={(e) => set("atpValidUntil", e.target.value)} className={field} />
          </label>
          <label className={label}>
            Series from
            <input value={p.atpSeriesFrom} onChange={(e) => set("atpSeriesFrom", e.target.value)} className={`${field} font-mono`} />
          </label>
          <label className={label}>
            Series to
            <input value={p.atpSeriesTo} onChange={(e) => set("atpSeriesTo", e.target.value)} className={`${field} font-mono`} />
          </label>
        </div>
        {nextInvoiceNo !== null && (
          <p className="mt-3 text-xs text-neutral-400">Next invoice issued will be numbered INV-{String(nextInvoiceNo).padStart(6, "0")}.</p>
        )}
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <button type="submit" disabled={saving} className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
        {saving ? "Saving…" : "Save business profile"}
      </button>
    </form>
  );
}
