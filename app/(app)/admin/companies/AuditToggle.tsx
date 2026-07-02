"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuditToggle({
  companyId,
  initialEnabled,
}: {
  companyId: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditLogEnabled: next }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update setting.");
      return;
    }
    setEnabled(next);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-neutral-800">Audit logging</div>
        <div className="text-xs text-neutral-500">
          {enabled
            ? "Recording logins and record changes for this company."
            : "Paused — no new audit entries are being recorded for this company."}
        </div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-brand-green" : "bg-neutral-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
