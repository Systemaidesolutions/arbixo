"use client";

import { useRef, useState } from "react";
import { Link2, Trash2, Plus } from "lucide-react";
import type { DisplayLink } from "@/lib/relatedLinks";

const MAX_BYTES = 1024 * 1024; // ~1MB

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type Row = DisplayLink & { logoPreview?: string | null; msg?: string };

function LogoThumb({ row }: { row: Row }) {
  const src =
    row.logoPreview !== undefined && row.logoPreview !== null
      ? row.logoPreview
      : row.hasLogo
        ? `/api/related-links/${row.id}/logo`
        : null;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-neutral-50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : (
        <Link2 size={18} className="text-neutral-300" />
      )}
    </div>
  );
}

export function RelatedLinksClient({ initialLinks }: { initialLinks: DisplayLink[] }) {
  const [rows, setRows] = useState<Row[]>(initialLinks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-link form
  const newLogoRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLogo, setNewLogo] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function onNewLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) return setError("Logo is too large (max ~1MB).");
    setNewLogo(await readAsDataUrl(file));
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const res = await fetch("/api/admin/related-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, url: newUrl, logoUrl: newLogo }),
    });
    setAdding(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not add link.");
      return;
    }
    const { id } = await res.json();
    setRows((prev) => [
      ...prev,
      { id, name: newName.trim(), url: newUrl.trim(), hasLogo: !!newLogo, logoPreview: newLogo },
    ]);
    setNewName("");
    setNewUrl("");
    setNewLogo(null);
    if (newLogoRef.current) newLogoRef.current.value = "";
  }

  async function saveRow(row: Row) {
    setError(null);
    setBusyId(row.id);
    const res = await fetch(`/api/admin/related-links/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: row.name, url: row.url }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not save.");
      return;
    }
    patchRow(row.id, { msg: "Saved" });
    setTimeout(() => patchRow(row.id, { msg: undefined }), 1500);
  }

  async function changeRowLogo(row: Row, file: File) {
    setError(null);
    if (file.size > MAX_BYTES) return setError("Logo is too large (max ~1MB).");
    const dataUrl = await readAsDataUrl(file);
    setBusyId(row.id);
    const res = await fetch(`/api/admin/related-links/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: dataUrl }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not update logo.");
      return;
    }
    patchRow(row.id, { hasLogo: true, logoPreview: dataUrl });
  }

  async function deleteRow(row: Row) {
    if (!confirm(`Delete "${row.name}"?`)) return;
    setError(null);
    setBusyId(row.id);
    const res = await fetch(`/api/admin/related-links/${row.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not delete.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  const field =
    "w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-blue focus:outline-none";

  return (
    <div className="mt-6 space-y-6">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Existing links */}
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
            No related links yet. Add your first one below.
          </p>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-3">
              <LogoThumb row={row} />
              <label className="cursor-pointer text-[11px] font-medium text-brand-blue hover:underline">
                Logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) changeRowLogo(row, f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <input
              value={row.name}
              onChange={(e) => patchRow(row.id, { name: e.target.value })}
              placeholder="Website name"
              className={`${field} sm:max-w-[200px]`}
            />
            <input
              value={row.url}
              onChange={(e) => patchRow(row.id, { url: e.target.value })}
              placeholder="https://…"
              className={`${field} flex-1`}
            />
            <div className="flex items-center gap-2">
              {row.msg && <span className="text-xs text-green-600">{row.msg}</span>}
              <button
                onClick={() => saveRow(row)}
                disabled={busyId === row.id}
                className="rounded bg-[#0B2A5E] px-3 py-1.5 text-xs text-white hover:bg-[#123A73] disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => deleteRow(row)}
                disabled={busyId === row.id}
                aria-label="Delete"
                className="rounded border border-red-300 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new */}
      <form onSubmit={addLink} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Add a link
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <LogoThumb row={{ id: "new", name: "", url: "", hasLogo: false, logoPreview: newLogo }} />
            <label className="cursor-pointer text-[11px] font-medium text-brand-blue hover:underline">
              Logo (optional)
              <input
                ref={newLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onNewLogo}
              />
            </label>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Website name (e.g. BIR)"
            className={`${field} sm:max-w-[200px]`}
          />
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="bir.gov.ph"
            className={`${field} flex-1`}
          />
          <button
            type="submit"
            disabled={adding || !newName.trim() || !newUrl.trim()}
            className="inline-flex items-center justify-center gap-1 rounded bg-brand-green px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            <Plus size={15} /> Add
          </button>
        </div>
      </form>
    </div>
  );
}
