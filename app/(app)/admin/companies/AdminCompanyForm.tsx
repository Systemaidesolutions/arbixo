"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyFields, toCompanyFormState } from "@/components/CompanyFields";
import type { CompanyFormPayload } from "@/lib/company";

type AssignableUser = { id: string; email: string };

export function AdminCompanyForm({
  mode,
  companyId,
  initialCompany,
  assignableUsers,
}: {
  mode: "create" | "edit";
  companyId?: string;
  initialCompany?: CompanyFormPayload | null;
  assignableUsers?: AssignableUser[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<CompanyFormPayload>(toCompanyFormState(initialCompany ?? null));
  const [userId, setUserId] = useState<string>(assignableUsers?.[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CompanyFormPayload>(key: K, value: CompanyFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && !userId) {
      setError("Select the subscriber this company belongs to.");
      return;
    }

    setSaving(true);
    const res =
      mode === "create"
        ? await fetch("/api/admin/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, ...form }),
          })
        : await fetch(`/api/admin/companies/${companyId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving the company.");
      return;
    }

    router.push("/admin/companies");
    router.refresh();
  }

  const noSubscribers = mode === "create" && (assignableUsers?.length ?? 0) === 0;

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {mode === "create" && (
        <label className="block text-xs text-neutral-500">
          Assign to subscriber
          {noSubscribers ? (
            <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Every subscriber already has a company. Create a subscriber account first, or one
              without a company must exist to assign this to.
            </p>
          ) : (
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm sm:max-w-md"
            >
              {assignableUsers?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      <CompanyFields form={form} onChange={set} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || noSubscribers}
          className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create company" : "Save changes"}
        </button>
        <a href="/admin/companies" className="text-sm text-neutral-500 hover:text-neutral-900">
          Cancel
        </a>
      </div>
    </form>
  );
}
