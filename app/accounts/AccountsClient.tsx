"use client";

import { useMemo, useState } from "react";
import type { Account, AccountClassification, NormalBalance } from "@prisma/client";
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATION_ORDER,
  DEFAULT_NORMAL_BALANCE,
  buildAccountTree,
  type AccountNode,
} from "@/lib/accounts";

type FormState = {
  mode: "create" | "edit";
  id?: string;
  code: string;
  title: string;
  classification: AccountClassification;
  normalBalance: NormalBalance;
  parentAccountId: string | null;
  openingBalance: string;
  isActive: boolean;
};

function emptyForm(classification: AccountClassification, parentAccountId: string | null = null): FormState {
  return {
    mode: "create",
    code: "",
    title: "",
    classification,
    normalBalance: DEFAULT_NORMAL_BALANCE[classification],
    parentAccountId,
    openingBalance: "0",
    isActive: true,
  };
}

export function AccountsClient({
  companyId,
  initialAccounts,
}: {
  companyId: string;
  initialAccounts: Account[];
}) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => buildAccountTree(accounts), [accounts]);

  async function refresh() {
    const res = await fetch(`/api/accounts?companyId=${companyId}`);
    const data = await res.json();
    setAccounts(data.accounts ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);

    const payload = {
      companyId,
      code: form.code.trim(),
      title: form.title.trim(),
      classification: form.classification,
      normalBalance: form.normalBalance,
      parentAccountId: form.parentAccountId,
      openingBalance: Number(form.openingBalance || 0),
      isActive: form.isActive,
    };

    const url = form.mode === "create" ? "/api/accounts" : `/api/accounts/${form.id}`;
    const method = form.mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving this account.");
      return;
    }

    setForm(null);
    await refresh();
  }

  async function handleDelete(account: Account) {
    if (!window.confirm(`Delete "${account.title}" (${account.code})? This can't be undone.`)) {
      return;
    }
    const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't delete this account.");
      return;
    }
    if (form?.id === account.id) setForm(null);
    await refresh();
  }

  function startEdit(account: Account) {
    setError(null);
    setForm({
      mode: "edit",
      id: account.id,
      code: account.code,
      title: account.title,
      classification: account.classification,
      normalBalance: account.normalBalance,
      parentAccountId: account.parentAccountId,
      openingBalance: account.openingBalance?.toString() ?? "0",
      isActive: account.isActive,
    });
  }

  function startCreateRoot(classification: AccountClassification) {
    setError(null);
    setForm(emptyForm(classification));
  }

  function startCreateChild(parent: Account) {
    setError(null);
    setForm(emptyForm(parent.classification, parent.id));
  }

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function renderNode(node: AccountNode, depth: number) {
    const isCollapsed = collapsed[node.id];
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-100 ${
            !node.isActive ? "opacity-50" : ""
          } ${form?.id === node.id ? "bg-neutral-100" : ""}`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <button
            onClick={() => hasChildren && toggleCollapsed(node.id)}
            className="w-4 shrink-0 text-neutral-400"
            aria-label={hasChildren ? (isCollapsed ? "Expand" : "Collapse") : undefined}
          >
            {hasChildren ? (isCollapsed ? "▸" : "▾") : ""}
          </button>

          <button
            onClick={() => startEdit(node)}
            className="flex flex-1 items-baseline gap-3 text-left"
          >
            <span className="font-mono text-sm text-neutral-500">{node.code}</span>
            <span className="text-sm text-neutral-900">{node.title}</span>
            {!node.isActive && <span className="text-xs text-neutral-400">(inactive)</span>}
          </button>

          <span className="text-xs text-neutral-400">{node.normalBalance === "DEBIT" ? "Dr" : "Cr"}</span>

          <button
            onClick={() => startCreateChild(node)}
            className="hidden shrink-0 text-xs text-neutral-500 hover:text-neutral-900 group-hover:block"
            title="Add sub-account"
          >
            + sub
          </button>
          <button
            onClick={() => handleDelete(node)}
            className="hidden shrink-0 text-xs text-red-500 hover:text-red-700 group-hover:block"
            title="Delete"
          >
            delete
          </button>
        </div>

        {hasChildren && !isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-[1fr_320px] gap-8 p-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-medium text-neutral-900">Chart of accounts</h1>
        </div>

        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {CLASSIFICATION_ORDER.map((classification) => {
            const roots = grouped[classification];
            return (
              <div key={classification}>
                <div className="flex items-center justify-between bg-neutral-50 px-3 py-2">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {CLASSIFICATION_LABELS[classification]}
                  </h2>
                  <button
                    onClick={() => startCreateRoot(classification)}
                    className="text-xs text-neutral-500 hover:text-neutral-900"
                  >
                    + account
                  </button>
                </div>
                <div className="py-1">
                  {roots.length === 0 ? (
                    <p className="px-4 py-1.5 text-sm text-neutral-400">No accounts yet</p>
                  ) : (
                    roots.map((node) => renderNode(node, 0))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="sticky top-8 self-start rounded-lg border border-neutral-200 p-4">
        {!form ? (
          <p className="text-sm text-neutral-500">
            Select an account to edit it, or use "+ account" / "+ sub" above to create one.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-900">
              {form.mode === "create" ? "New account" : "Edit account"}
              {form.parentAccountId && (
                <span className="ml-1 font-normal text-neutral-400">(sub-account)</span>
              )}
            </h2>

            <label className="block text-xs text-neutral-500">
              Code
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
              />
            </label>

            <label className="block text-xs text-neutral-500">
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>

            <label className="block text-xs text-neutral-500">
              Classification
              <select
                value={form.classification}
                disabled={!!form.parentAccountId}
                onChange={(e) => {
                  const classification = e.target.value as AccountClassification;
                  setForm({
                    ...form,
                    classification,
                    normalBalance: DEFAULT_NORMAL_BALANCE[classification],
                  });
                }}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
              >
                {CLASSIFICATION_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CLASSIFICATION_LABELS[c]}
                  </option>
                ))}
              </select>
              {form.parentAccountId && (
                <span className="mt-1 block text-xs text-neutral-400">
                  Sub-accounts inherit their parent's classification.
                </span>
              )}
            </label>

            <label className="block text-xs text-neutral-500">
              Normal balance
              <select
                value={form.normalBalance}
                onChange={(e) => setForm({ ...form, normalBalance: e.target.value as NormalBalance })}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              >
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
              <span className="mt-1 block text-xs text-neutral-400">
                Override for contra accounts (e.g. Accumulated Depreciation is Credit).
              </span>
            </label>

            <label className="block text-xs text-neutral-500">
              Opening balance
              <input
                type="number"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>

            {form.mode === "edit" && (
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : form.mode === "create" ? "Create" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </aside>
    </main>
  );
}
