"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Branch = {
  id: string;
  name: string;
  address: string | null;
  tin: string | null;
  branchCode: string | null;
  isDefault: boolean;
};

type Form = { name: string; tin: string; branchCode: string; address: string; isDefault: boolean };
const blank = (): Form => ({ name: "", tin: "", branchCode: "", address: "", isDefault: false });

const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const labelCls = "block text-xs text-neutral-500";

// Kept at module scope (not nested in BranchesManager) so React doesn't remount
// it — and drop input focus — on every keystroke.
function BranchForm({
  form,
  setForm,
  onSave,
  onCancel,
  busy,
  error,
  isNew,
}: {
  form: Form;
  setForm: (f: Form) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
  isNew: boolean;
}) {
  return (
    <div className="mt-2 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Branch name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Head Office / Makati branch" className={field} />
        </label>
        <label className={labelCls}>
          TIN (optional)
          <input value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} placeholder="000-000-000-000" className={field} />
        </label>
        <label className={labelCls}>
          Branch code
          <input
            value={form.branchCode}
            onChange={(e) => setForm({ ...form, branchCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            placeholder="00000"
            inputMode="numeric"
            className={field}
          />
          <span className="mt-0.5 block text-[11px] text-neutral-400">5 digits — head office is 00000.</span>
        </label>
        <label className={labelCls}>
          Address (optional)
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={field} />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
        Default branch (pre-selected when encoding)
      </label>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={onSave} disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
          {isNew ? "Add branch" : "Save"}
        </button>
        <button onClick={onCancel} disabled={busy} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

/**
 * Create / edit / delete a company's branches (Location rows). Used on both the
 * admin company page and the subscriber Setup > Branches page — `endpoint` is
 * the CRUD route and `canEdit` gates the controls (read-only otherwise).
 */
export function BranchesManager({
  endpoint,
  initial,
  canEdit,
}: {
  endpoint: string;
  initial: Branch[];
  canEdit: boolean;
}) {
  const router = useRouter();
  // Which row is open: a branch id, "new", or null (list only).
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAdd() {
    setForm(blank());
    setEditing("new");
    setError(null);
  }
  function startEdit(b: Branch) {
    setForm({ name: b.name, tin: b.tin ?? "", branchCode: b.branchCode ?? "", address: b.address ?? "", isDefault: b.isDefault });
    setEditing(b.id);
    setError(null);
  }
  function cancel() {
    setEditing(null);
    setError(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Branch name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const isNew = editing === "new";
    const res = await fetch(endpoint, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isNew ? {} : { branchId: editing }),
        name: form.name,
        tin: form.tin,
        branchCode: form.branchCode,
        address: form.address,
        isDefault: form.isDefault,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not save.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(b: Branch) {
    if (!confirm(`Delete branch "${b.name}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: b.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not delete.");
      return;
    }
    if (editing === b.id) setEditing(null);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-800">Branches</h2>
          <p className="text-xs text-neutral-500">Tag where entries originate; used for per-branch BIR reports and their upload filenames.</p>
        </div>
        {canEdit && editing !== "new" && (
          <button onClick={startAdd} className="rounded border border-brand-blue px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-blue-50">
            + Add branch
          </button>
        )}
      </div>

      {canEdit && editing === "new" && (
        <BranchForm form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} error={error} isNew />
      )}

      <ul className="mt-3 divide-y divide-neutral-100">
        {initial.length === 0 && editing !== "new" && (
          <li className="py-3 text-sm text-neutral-400">
            No branches yet.{canEdit ? " Add one to enable per-branch reporting." : ""}
          </li>
        )}
        {initial.map((b) => (
          <li key={b.id} className="py-2">
            {canEdit && editing === b.id ? (
              <BranchForm form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} error={error} isNew={false} />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-800">{b.name}</span>
                    {b.isDefault && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Default</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Branch code <span className="font-mono">{((b.branchCode ?? "").replace(/\D/g, "") || "0").padStart(5, "0")}</span>
                    {b.tin && <> · TIN <span className="font-mono">{b.tin}</span></>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => startEdit(b)} className="rounded px-2 py-1 text-xs text-brand-blue hover:bg-blue-50">Edit</button>
                    <button onClick={() => remove(b)} disabled={busy} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && editing === null && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
