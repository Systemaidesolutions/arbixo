"use client";

import { useState } from "react";

// Starts an admin "acting as" session for one company (lib/adminActingAs.ts)
// — full Manager-level access to its books, for support/troubleshooting.
export function AccessCompanyButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [busy, setBusy] = useState(false);

  async function access() {
    if (!window.confirm(`Access "${companyName}" as an administrator? You'll have full Manager-level access to its books until you exit.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/companies/${companyId}/act-as`, { method: "POST" });
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      setBusy(false);
      window.alert((await res.json().catch(() => ({})))?.error ?? "Could not access this company.");
    }
  }

  return (
    <button onClick={access} disabled={busy} className="text-xs font-medium text-brand-blue hover:underline disabled:opacity-50">
      {busy ? "Accessing…" : "Access"}
    </button>
  );
}
