"use client";

import { useState } from "react";

// Persistent, impossible-to-miss banner while an admin is acting inside a
// company's books (lib/adminActingAs.ts) — full Manager-level access to
// real customer data is powerful enough that it should never be ambiguous
// which "session" you're in.
export function AdminActingAsBanner({ companyName }: { companyName: string }) {
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    await fetch("/api/admin/act-as/exit", { method: "POST" });
    window.location.href = "/admin/companies";
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        You&apos;re accessing <strong>{companyName}</strong> as an administrator — full access, same as their own Manager.
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="rounded bg-amber-950/10 px-3 py-1 text-xs font-semibold hover:bg-amber-950/20 disabled:opacity-50"
      >
        {exiting ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
