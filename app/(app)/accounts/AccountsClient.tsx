"use client";

import { useMemo, useState } from "react";
import type { Account, AccountClassification, AccountType, NormalBalance } from "@prisma/client";
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATION_ORDER,
  DEFAULT_NORMAL_BALANCE,
} from "@/lib/accounts";

type Node = Account & { children: Node[] };

// Build a single nested forest ordered by sortOrder then code.
function buildForest(accounts: Account[]): Node[] {
  const byId = new Map<string, Node>();
  for (const a of accounts) byId.set(a.id, { ...a, children: [] });
  const roots: Node[] = [];
  for (const n of byId.values()) {
    const parent = n.parentAccountId ? byId.get(n.parentAccountId) : null;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const sort = (arr: Node[]) => {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    arr.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

type FormState = {
  mode: "create" | "edit";
  id?: string;
  accountType: AccountType;
  code: string;
  title: string;
  classification: AccountClassification;
  normalBalance: NormalBalance;
  parentAccountId: string | null;
  parentLabel: string | null;
  openingBalance: string;
  isActive: boolean;
};

function emptyForm(
  accountType: AccountType,
  parentAccountId: string | null,
  parentLabel: string | null,
  classification: AccountClassification = "OTHER_CURRENT_ASSET"
): FormState {
  return {
    mode: "create",
    accountType,
    code: "",
    title: "",
    classification,
    normalBalance: DEFAULT_NORMAL_BALANCE[classification],
    parentAccountId,
    parentLabel,
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
  const [seeding, setSeeding] = useState(false);

  const forest = useMemo(() => buildForest(accounts), [accounts]);

  async function refresh() {
    const res = await fetch(`/api/accounts?companyId=${companyId}`);
    const data = await res.json();
    setAccounts(data.accounts ?? []);
  }

  async function loadDefaults() {
    if (!window.confirm("Add the standard heading structure? Any account codes you already use are skipped, and nothing you have is changed. You can then nest your accounts under a heading.")) return;
    setSeeding(true);
    setError(null);
    const res = await fetch("/api/accounts/seed-defaults", { method: "POST" });
    setSeeding(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Couldn't load the default accounts.");
      return;
    }
    await refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);

    const payload = {
      companyId,
      accountType: form.accountType,
      code: form.code.trim(),
      title: form.title.trim(),
      classification: form.classification,
      normalBalance: form.normalBalance,
      parentAccountId: form.parentAccountId,
      openingBalance: form.accountType === "POSTING" ? Number(form.openingBalance || 0) : 0,
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
      setError((await res.json().catch(() => ({})))?.error ?? "Something went wrong saving this account.");
      return;
    }
    setForm(null);
    await refresh();
  }

  async function handleDelete(account: Account) {
    if (!window.confirm(`Delete "${account.title}" (${account.code})? This can't be undone.`)) return;
    const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Couldn't delete this account.");
      return;
    }
    if (form?.id === account.id) setForm(null);
    await refresh();
  }

  function startEdit(a: Account) {
    setError(null);
    const parent = a.parentAccountId ? accounts.find((x) => x.id === a.parentAccountId) : null;
    setForm({
      mode: "edit",
      id: a.id,
      accountType: a.accountType,
      code: a.code,
      title: a.title,
      classification: a.classification,
      normalBalance: a.normalBalance,
      parentAccountId: a.parentAccountId,
      parentLabel: parent ? `${parent.code} ${parent.title}` : null,
      openingBalance: a.openingBalance?.toString() ?? "0",
      isActive: a.isActive,
    });
  }

  function startCreateRoot() {
    setError(null);
    setForm(emptyForm("HEADING", null, null));
  }

  function startCreateChild(parent: Account) {
    setError(null);
    setForm(emptyForm("POSTING", parent.id, `${parent.code} ${parent.title}`, parent.classification));
  }

  function toggle(id: string) {
    setCollapsed((p) => ({ ...p, [id]: !p[id] }));
  }

  function renderNode(node: Node, depth: number) {
    const isHeading = node.accountType === "HEADING";
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
            onClick={() => hasChildren && toggle(node.id)}
            className="w-4 shrink-0 text-neutral-400"
          >
            {hasChildren ? (isCollapsed ? "▸" : "▾") : ""}
          </button>

          <button onClick={() => startEdit(node)} className="flex flex-1 items-baseline gap-3 text-left">
            <span className="font-mono text-sm text-neutral-500">{node.code}</span>
            <span className={`text-sm ${isHeading ? "font-semibold text-brand-navy" : "text-neutral-900"}`}>
              {node.title}
            </span>
            {isHeading ? (
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                Heading
              </span>
            ) : (
              <span className="text-xs text-neutral-400">{node.normalBalance === "DEBIT" ? "Dr" : "Cr"}</span>
            )}
            {!node.isActive && <span className="text-xs text-neutral-400">(inactive)</span>}
          </button>

          {isHeading && (
            <button
              onClick={() => startCreateChild(node)}
              className="hidden shrink-0 text-xs text-neutral-500 hover:text-neutral-900 group-hover:block"
              title="Add account under this heading"
            >
              + sub
            </button>
          )}
          <button
            onClick={() => handleDelete(node)}
            className="hidden shrink-0 text-xs text-red-500 hover:text-red-700 group-hover:block"
          >
            delete
          </button>
        </div>
        {hasChildren && !isCollapsed && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm";

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-[1fr_320px] gap-8 p-4 sm:p-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-medium text-neutral-900">Chart of accounts</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDefaults}
              disabled={seeding}
              className="rounded bg-[#0B2A5E] px-3 py-1.5 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
            >
              {seeding ? "Loading…" : "Load default headings"}
            </button>
            <button
              onClick={startCreateRoot}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              + heading
            </button>
          </div>
        </div>

        {error && !form && <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="rounded-lg border border-neutral-200 p-2">
          {forest.length === 0 ? (
            <p className="px-2 py-3 text-sm text-neutral-400">
              No accounts yet. Use “Load default chart of accounts”, or “+ heading” to start.
            </p>
          ) : (
            forest.map((n) => renderNode(n, 0))
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Headings are structural subtotals — you can&apos;t post to them. Add posting accounts under a
          heading with “+ sub”.
        </p>
      </section>

      <aside className="sticky top-8 self-start rounded-lg border border-neutral-200 p-4">
        {!form ? (
          <p className="text-sm text-neutral-500">
            Select an account to edit, use “+ heading” for a top-level group, or “+ sub” on a heading to
            add an account under it.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-900">
              {form.mode === "create" ? "New account" : "Edit account"}
            </h2>

            <label className="block text-xs text-neutral-500">
              Parent (heading)
              <select
                value={form.parentAccountId ?? ""}
                onChange={(e) => setForm({ ...form, parentAccountId: e.target.value || null })}
                className={field}
              >
                <option value="">— None (top level) —</option>
                {accounts
                  .filter((a) => a.accountType === "HEADING" && a.id !== form.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} {a.title}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-xs text-neutral-500">
              Type
              <select
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value as AccountType })}
                className={field}
              >
                <option value="POSTING">Posting (postable)</option>
                <option value="HEADING">Heading (subtotal, non-postable)</option>
              </select>
            </label>

            <label className="block text-xs text-neutral-500">
              Code
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={`${field} font-mono`}
              />
            </label>

            <label className="block text-xs text-neutral-500">
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={field}
              />
            </label>

            <label className="block text-xs text-neutral-500">
              Category
              <select
                value={form.classification}
                onChange={(e) => {
                  const classification = e.target.value as AccountClassification;
                  setForm({ ...form, classification, normalBalance: DEFAULT_NORMAL_BALANCE[classification] });
                }}
                className={field}
              >
                {CLASSIFICATION_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CLASSIFICATION_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>

            {form.accountType === "POSTING" && (
              <>
                <label className="block text-xs text-neutral-500">
                  Normal balance
                  <select
                    value={form.normalBalance}
                    onChange={(e) => setForm({ ...form, normalBalance: e.target.value as NormalBalance })}
                    className={field}
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-500">
                  Opening balance
                  <input
                    type="number"
                    step="0.01"
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                    className={field}
                  />
                </label>
              </>
            )}

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
                className="rounded bg-[#0B2A5E] px-3 py-1.5 text-sm text-white hover:bg-[#123A73] disabled:opacity-50"
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
