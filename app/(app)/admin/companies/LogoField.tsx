"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoField({ companyId, initial }: { companyId: string; initial: string | null }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: logoUrl || null }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not save.");
      return;
    }
    setMsg("Logo saved.");
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-800">Company logo</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Image URL — shown on the subscriber&apos;s dashboard.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…/logo.png"
          className="w-full max-w-md rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-9 w-auto rounded border border-neutral-200 bg-white object-contain"
          />
        )}
        <button
          onClick={save}
          disabled={busy}
          className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
        >
          Save
        </button>
        {msg && <span className="text-xs text-green-600">{msg}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </section>
  );
}
