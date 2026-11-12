"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

export type ApiCredentialRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** Create / revoke a company's integration API keys. `canEdit` gates
 * generating or revoking a key (Manager-only); everyone else sees the list
 * read-only. The plaintext key is shown exactly once, right after creation —
 * same pattern as every other secret in this app. */
export function ApiCredentialsManager({ initial, canEdit }: { initial: ApiCredentialRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setError("Give this key a name (e.g. the system that will use it).");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/company/api-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create the key.");
      return;
    }
    setNewKey(data.key);
    setName("");
    setAdding(false);
    router.refresh();
  }

  async function revoke(row: ApiCredentialRow) {
    if (!confirm(`Revoke the API key "${row.name}"? Anything still using it will stop working immediately.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/company/api-credentials/${row.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not revoke.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-800">API keys</h2>
          <p className="text-xs text-neutral-500">
            For an external system (e.g. your own core system) to post and read your books via the{" "}
            <a href="/developers" target="_blank" className="text-brand-blue underline">integration API</a>.
          </p>
        </div>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="rounded border border-brand-blue px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-blue-50">
            + Generate key
          </button>
        )}
      </div>

      {newKey && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">
            Copy this key now — you won&apos;t be able to see it again. Store it securely on the system that will use it.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs">{newKey}</code>
            <button
              onClick={() => navigator.clipboard.writeText(newKey)}
              className="shrink-0 rounded border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              Copy
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-neutral-500 underline">Done</button>
        </div>
      )}

      {canEdit && adding && (
        <div className="mt-2 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
          <label className="block text-xs text-neutral-500">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BUPCC Financial Engine"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              autoFocus
            />
          </label>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={create} disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
              Generate
            </button>
            <button onClick={() => { setAdding(false); setError(null); }} disabled={busy} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
              Cancel
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>
      )}

      <ul className="mt-3 divide-y divide-neutral-100">
        {initial.length === 0 && !adding && (
          <li className="py-3 text-sm text-neutral-400">No API keys yet.{canEdit ? " Generate one to connect an external system." : ""}</li>
        )}
        {initial.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-neutral-800">{row.name}</span>
                {row.revokedAt && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">Revoked</span>}
              </div>
              <div className="text-xs text-neutral-500">
                <span className="font-mono">{row.keyPrefix}…</span> · created {formatDate(new Date(row.createdAt))}
                {row.lastUsedAt && <> · last used {formatDate(new Date(row.lastUsedAt))}</>}
              </div>
            </div>
            {canEdit && !row.revokedAt && (
              <button onClick={() => revoke(row)} disabled={busy} className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && !adding && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
