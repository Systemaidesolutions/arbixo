"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Building2 } from "lucide-react";

type CompanyOption = { id: string; tradeName: string };

// Dropdown for a USER account with access to more than one company (see
// lib/userCompanyAccess.ts) — switches which company's books every page
// works against, for the rest of this browser session.
export function CompanySwitcher({
  companies,
  activeCompanyId,
}: {
  companies: CompanyOption[];
  activeCompanyId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = companies.find((c) => c.id === activeCompanyId);

  async function switchTo(companyId: string) {
    if (companyId === activeCompanyId || switching) return;
    setSwitching(true);
    const res = await fetch("/api/user/switch-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    if (res.ok) {
      window.location.href = "/dashboard";
      return;
    }
    setSwitching(false);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex max-w-[32vw] items-center gap-1.5 rounded px-1.5 py-1 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"
      >
        <Building2 size={14} className="shrink-0 text-white/70" />
        <span className="truncate">{active?.tradeName ?? "Select company"}</span>
        <ChevronDown size={14} className="shrink-0 text-white/60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded border border-neutral-200 bg-white py-1 text-neutral-900 shadow-lg">
          <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Switch company
          </div>
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => switchTo(c.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-50"
            >
              <span className="w-4 shrink-0">{c.id === activeCompanyId && <Check size={14} className="text-brand-green" />}</span>
              <span className="truncate">{c.tradeName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
