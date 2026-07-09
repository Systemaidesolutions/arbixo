"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";

type ItemType = "INVENTORY" | "NON_INVENTORY" | "SERVICE";
type VatType = "VAT_12" | "ZERO_RATED" | "VAT_EXEMPT" | "NON_VAT";
type Account = { id: string; code: string; title: string };
export type Item = {
  id: string; code: string; description: string; type: ItemType; uom: string | null;
  vatType: VatType; defaultCost: number; quantityOnHand: number; avgCost: number;
  inventoryAccountId: string | null; expenseAccountId: string | null; incomeAccountId: string | null; isActive: boolean;
};
type Form = Omit<Item, "id" | "quantityOnHand" | "avgCost">;

const blank = (): Form => ({ code: "", description: "", type: "INVENTORY", uom: "", vatType: "VAT_12", defaultCost: 0, inventoryAccountId: null, expenseAccountId: null, incomeAccountId: null, isActive: true });
const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const label = "block text-xs text-neutral-500";
const TYPE_LABEL: Record<ItemType, string> = { INVENTORY: "Inventory", NON_INVENTORY: "Non-inventory", SERVICE: "Service" };
const VAT_LABEL: Record<VatType, string> = { VAT_12: "12% VAT", ZERO_RATED: "Zero-rated", VAT_EXEMPT: "VAT-exempt", NON_VAT: "Non-VAT" };

export function ItemsClient({ initial, accounts, canEdit }: { initial: Item[]; accounts: Account[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  function startAdd() { setForm(blank()); setEditing("new"); setError(null); }
  function startEdit(it: Item) { const { id: _id, quantityOnHand: _q, avgCost: _a, ...rest } = it; setForm(rest); setEditing(it.id); setError(null); }
  function cancel() { setEditing(null); setError(null); }

  async function save() {
    if (editing === "new" && !form.code.trim()) return setError("Item code is required.");
    if (!form.description.trim()) return setError("Description is required.");
    setBusy(true); setError(null);
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/items" : `/api/items/${editing}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, defaultCost: Number(form.defaultCost) || 0, code: form.code.trim() }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(d.error ?? "Could not save."); }
    setEditing(null); router.refresh();
  }

  async function toggleActive(it: Item) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/items/${it.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !it.isActive }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(d.error ?? "Could not update."); }
    router.refresh();
  }

  const rows = showInactive ? initial : initial.filter((i) => i.isActive);

  function AccountSelect({ value, onChange, placeholder }: { value: string | null; onChange: (v: string | null) => void; placeholder: string }) {
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={field}>
        <option value="">{placeholder}</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title}</option>)}
      </select>
    );
  }

  function EditForm() {
    const isNew = editing === "new";
    return (
      <div className="mt-2 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={label}>Item code<input value={form.code} disabled={!isNew} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="OFFSUP-001" className={`${field} font-mono ${!isNew ? "bg-neutral-100" : ""}`} /></label>
          <label className={`${label} sm:col-span-2`}>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} /></label>
          <label className={label}>Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ItemType })} className={field}>{Object.entries(TYPE_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
          <label className={label}>Unit of measure<input value={form.uom ?? ""} onChange={(e) => setForm({ ...form, uom: e.target.value })} placeholder="pcs / ream" className={field} /></label>
          <label className={label}>Default cost<input value={String(form.defaultCost)} onChange={(e) => setForm({ ...form, defaultCost: Number(e.target.value) || 0 })} inputMode="decimal" className={field} /></label>
          <label className={label}>VAT<select value={form.vatType} onChange={(e) => setForm({ ...form, vatType: e.target.value as VatType })} className={field}>{Object.entries(VAT_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
          {form.type === "INVENTORY" && (
            <label className={label}>Inventory account (asset)<AccountSelect value={form.inventoryAccountId} onChange={(v) => setForm({ ...form, inventoryAccountId: v })} placeholder="Select…" /></label>
          )}
          <label className={label}>{form.type === "INVENTORY" ? "COGS account" : "Expense account"}<AccountSelect value={form.expenseAccountId} onChange={(v) => setForm({ ...form, expenseAccountId: v })} placeholder="Select…" /></label>
          <label className={label}>Income account (sales)<AccountSelect value={form.incomeAccountId} onChange={(v) => setForm({ ...form, incomeAccountId: v })} placeholder="Select…" /></label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={save} disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">{isNew ? "Add item" : "Save"}</button>
          <button onClick={cancel} disabled={busy} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-800">Items ({rows.length})</h2>
          <p className="text-xs text-neutral-500">Inventory & service items used on purchase and sales documents.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-500"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
          {canEdit && editing !== "new" && <button onClick={startAdd} className="rounded border border-brand-blue px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-blue-50">+ Add item</button>}
        </div>
      </div>

      {canEdit && editing === "new" && <EditForm />}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3 text-right">On hand</th><th className="py-2 pr-3 text-right">Avg cost</th><th className="py-2 pr-3">Status</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 && <tr><td colSpan={7} className="py-3 text-neutral-400">No items yet.</td></tr>}
            {rows.map((it) => (
              canEdit && editing === it.id ? (
                <tr key={it.id}><td colSpan={7}><EditForm /></td></tr>
              ) : (
                <tr key={it.id} className={it.isActive ? "" : "text-neutral-400"}>
                  <td className="py-1.5 pr-3 font-mono text-xs">{it.code}</td>
                  <td className="py-1.5 pr-3">{it.description}</td>
                  <td className="py-1.5 pr-3 text-xs">{TYPE_LABEL[it.type]}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{it.type === "INVENTORY" ? Number(it.quantityOnHand) : "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{it.type === "INVENTORY" ? formatPeso(Number(it.avgCost)) : "—"}</td>
                  <td className="py-1.5 pr-3">{it.isActive ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Active</span> : <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Inactive</span>}</td>
                  <td className="py-1.5 text-right">
                    {canEdit && <>
                      <button onClick={() => startEdit(it)} className="rounded px-2 py-1 text-xs text-brand-blue hover:bg-blue-50">Edit</button>
                      <button onClick={() => toggleActive(it)} disabled={busy} className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50">{it.isActive ? "Deactivate" : "Activate"}</button>
                    </>}
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
      {error && editing === null && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
