"use client";

import { useState } from "react";
import { Headphones, X } from "lucide-react";

/**
 * Floating help affordance pinned to the bottom-right. Collapsed it shows just
 * the headset icon + "Need Help"; clicking expands the full support card.
 */
export function HelpWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 z-50 print:hidden">
      {open ? (
        <div className="relative w-64 rounded-xl bg-brand-navy p-4 text-center shadow-xl ring-1 ring-white/10">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-2 top-2 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/20">
            <Headphones size={18} className="text-brand-blue" />
          </div>
          <p className="mt-2 text-sm font-medium text-white">Need help?</p>
          <p className="text-xs text-white/60">We&apos;re here to assist you.</p>
          <a
            href="mailto:info.systemaidesolutions@gmail.com"
            className="mt-3 inline-block rounded-lg bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
          >
            Contact Support
          </a>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-white/10 hover:brightness-110"
        >
          <Headphones size={18} className="text-brand-blue" />
          Need Help
        </button>
      )}
    </div>
  );
}
