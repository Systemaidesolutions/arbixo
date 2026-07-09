"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type IncomePaymentType = "GOODS" | "SERVICES" | "BOTH";
export type Atc = { id: string; code: string; description: string; ratePercent: number; incomePaymentType: IncomePaymentType; isActive: boolean };
type Form = { code: string; description: string; ratePercent: string; incomePaymentType: IncomePaymentType };

const blank = (): Form => ({ code: "", description: "", ratePercent: "", incomePaymentType: "BOTH" });
const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const label = "block text-xs text-neutral-500";

export function AtcCodesClient({ initial }: { initial: Atc[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState<Form>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function startAdd() { setForm(blank()); setEditing("new"); setError(null); }
  function startEdit(a: Atc) { setForm({ code: a.code, description: a.description, ratePercent: String(a.ratePercent), incomePaymentType: a.incomePaymentType }); setEditing(a.id); setError(null); }
  function cancel() { setEditing(null); setError(null); }

  async function save() {
    const isNew = editing === "new";
    const rate = Number(form.ratePercent);
    if (isNew && !form.code.trim()) return setError("Code is required.");
    if (!form.description.trim()) return setError("Description is required.");
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return setError("Rate must be a number between 0 and 100.");
    setBusy(true); setError(null);
    const res = await fetch(isNew ? "/api/atc-codes" : `/api/atc-codes/${editing}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew
        ? { code: form.code.trim().toUpperCase(), description: form.description.trim(), ratePercent: rate, incomePaymentType: form.incomePaymentType }
        : { description: form.description.trim(), ratePercent: rate, incomePaymentType: form.incomePaymentType }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(d.error ?? "Could not save."); }
    setEditing(null); router.refresh();
  }

  async function toggleActive(a: Atc) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/atc-codes/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !a.isActive }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(d.error ?? "Could not update."); }
    router.refresh();
  }

  async function runImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setImportMsg("Choose a .csv or .xlsx file first.");
    setImporting(true); setImportMsg(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/atc-codes/import", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setImporting(false);
    if (!res.ok) return setImportMsg(d.error ?? "Import failed.");
    setImportMsg(`Imported: ${d.created} new, ${d.updated} updated${d.issues?.length ? `, ${d.issues.length} skipped` : ""}.`);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const rows = showInactive ? initial : initial.filter((a) => a.isActive);
  const TYPE_LABEL: Record<IncomePaymentType, string> = { GOODS: "Goods", SERVICES: "Services", BOTH: "Both" };

  function EditForm() {
    const isNew = editing === "new";
    return (
      <div className="mt-2 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={label}>
            Code
            <input value={form.code} disabled={!isNew} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WI010" className={`${field} ${!isNew ? "bg-neutral-100 font-mono" : "font-mono"}`} />
          </label>
          <label className={label}>
            Rate %
            <input value={form.ratePercent} onChange={(e) => setForm({ ...form, ratePercent: e.target.value })} placeholder="5" inputMode="decimal" className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
          </label>
          <label className={label}>
            Income payment type
            <select value={form.incomePaymentType} onChange={(e) => setForm({ ...form, incomePaymentType: e.target.value as IncomePaymentType })} className={field}>
              <option value="BOTH">Both</option>
              <option value="GOODS">Goods</option>
              <option value="SERVICES">Services</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={save} disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">{isNew ? "Add code" : "Save"}</button>
          <button onClick={cancel} disabled={busy} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Import */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-800">Import from Excel/CSV</h2>
        <p className="text-xs text-neutral-500">Bulk-load the BIR ATC catalogue. Upserts by code (existing codes are updated).</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href="/api/atc-codes/import/template" download className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Download template (.csv)</a>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="text-sm" />
          <button onClick={runImport} disabled={importing} className="rounded bg-[#0B2A5E] px-3 py-1.5 text-sm text-white hover:bg-[#123A73] disabled:opacity-50">{importing ? "Importing…" : "Import"}</button>
          {importMsg && <span className="text-xs text-neutral-600">{importMsg}</span>}
        </div>
      </section>

      {/* List + add */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-neutral-800">ATC codes ({rows.length})</h2>
            <p className="text-xs text-neutral-500">Global withholding-tax codes used across all companies.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
            </label>
            {editing !== "new" && <button onClick={startAdd} className="rounded border border-brand-blue px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-blue-50">+ Add code</button>}
          </div>
        </div>

        {editing === "new" && <EditForm />}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">Rate</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.length === 0 && <tr><td colSpan={6} className="py-3 text-neutral-400">No codes.</td></tr>}
              {rows.map((a) => (
                editing === a.id ? (
                  <tr key={a.id}><td colSpan={6}><EditForm /></td></tr>
                ) : (
                  <tr key={a.id} className={a.isActive ? "" : "text-neutral-400"}>
                    <td className="py-1.5 pr-3 font-mono text-xs">{a.code}</td>
                    <td className="py-1.5 pr-3">{a.description}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{a.ratePercent}%</td>
                    <td className="py-1.5 pr-3 text-xs">{TYPE_LABEL[a.incomePaymentType]}</td>
                    <td className="py-1.5 pr-3">
                      {a.isActive ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Active</span> : <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Inactive</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => startEdit(a)} className="rounded px-2 py-1 text-xs text-brand-blue hover:bg-blue-50">Edit</button>
                      <button onClick={() => toggleActive(a)} disabled={busy} className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50">{a.isActive ? "Deactivate" : "Activate"}</button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
        {error && editing === null && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </section>
    </div>
  );
}
