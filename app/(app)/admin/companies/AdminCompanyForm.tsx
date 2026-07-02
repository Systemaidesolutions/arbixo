"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyFields, toCompanyFormState } from "@/components/CompanyFields";
import type { CompanyFormPayload } from "@/lib/company";

export function AdminCompanyForm({
  mode,
  companyId,
  initialCompany,
}: {
  mode: "create" | "edit";
  companyId?: string;
  initialCompany?: CompanyFormPayload | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CompanyFormPayload>(toCompanyFormState(initialCompany ?? null));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CompanyFormPayload>(key: K, value: CompanyFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res =
      mode === "create"
        ? await fetch("/api/admin/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
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

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <CompanyFields form={form} onChange={set} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create company" : "Update details"}
        </button>
        <a href="/admin/companies" className="text-sm text-neutral-500 hover:text-neutral-900">
          Cancel
        </a>
      </div>
    </form>
  );
}
