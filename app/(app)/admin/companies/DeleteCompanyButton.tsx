"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deleting a company is irreversible, so require TWO explicit confirmations
// before the request is sent.
export function DeleteCompanyButton({ companyId, tradeName }: { companyId: string; tradeName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const first = window.confirm(
      `Delete "${tradeName}"?\n\n` +
        "This permanently removes the company and ALL of its data — transactions, " +
        "accounts, branches, customers/vendors, number series, reports and audit logs. " +
        "Assigned users are unassigned (their accounts are kept).\n\nThis CANNOT be undone."
    );
    if (!first) return;

    const second = window.confirm(
      `FINAL CONFIRMATION\n\nReally delete "${tradeName}" and everything in it? ` +
        "There is no way to recover this data."
    );
    if (!second) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/companies/${companyId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setBusy(false);
      setError(d.error ?? "Could not delete the company.");
      return;
    }
    router.push("/admin/companies");
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-lg border border-red-200 bg-red-50/40 p-4">
      <h2 className="text-sm font-medium text-red-800">Danger zone</h2>
      <p className="mt-1 text-xs text-red-700">
        Permanently delete this company and all of its data. This can&apos;t be undone.
      </p>
      <button
        onClick={onDelete}
        disabled={busy}
        className="mt-3 rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete company"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
