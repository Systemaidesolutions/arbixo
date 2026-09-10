"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const CONTACT_EMAIL = "info@arbixo.net";

// The source art has a lot of empty canvas above the character, so a plain
// object-fit:cover (same aspect ratio in and out) wouldn't crop in on the
// face at all — we zoom in via background-size/position instead, tuned by
// eye against the actual image so the face + magnifying glass fill the circle.
function ArbiAvatar({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/arbi-help-avatar.png)",
        backgroundSize: "250% 250%",
        backgroundPosition: "50% 35%",
        backgroundRepeat: "no-repeat",
      }}
      className="shrink-0 rounded-full bg-white"
    />
  );
}

// Floating help launcher — mounted once in the root layout, so it's
// available on every page (marketing site included). Click toggles a
// small panel; it never intercepts print output since printed reports
// only ever render their own page content, but we hide it defensively
// anyway in case a page's print styles don't scope tightly.
//
// Stacked/modal app pages (components/PageStack.tsx) render inside an
// iframe that loads the SAME root layout, so without a check this widget
// would render a second time inside every open panel. Mirrors AppShell's
// own embedded-detection so it bows out there and only the outer page's
// copy shows.
export function ArbiHelpWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const embedParam = useSearchParams().get("_embed") === "1";
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => {
    try {
      setInFrame(window.self !== window.top);
    } catch {
      setInFrame(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (embedParam || inFrame) return null;

  const linkClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50";

  return (
    <div ref={panelRef} className="fixed bottom-4 right-4 z-50 print:hidden">
      {open && (
        <div className="mb-3 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="flex items-center gap-3 bg-brand-navy px-4 py-3">
            <ArbiAvatar size={36} />
            <div>
              <div className="text-sm font-semibold text-white">Hi, I&apos;m ARbi</div>
              <div className="text-xs text-white/70">How can I help?</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="ml-auto rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="p-2">
            <a href="/ask-arbi" className={linkClass}>
              <span className="text-lg">💬</span>
              <span>
                <span className="block font-medium text-neutral-900">Ask ARbi</span>
                <span className="block text-xs text-neutral-500">Get a report by just asking</span>
              </span>
            </a>
            <a href="/#faq" className={linkClass}>
              <span className="text-lg">❓</span>
              <span>
                <span className="block font-medium text-neutral-900">FAQs &amp; how-to guides</span>
                <span className="block text-xs text-neutral-500">Common questions, answered</span>
              </span>
            </a>
            <a href={`mailto:${CONTACT_EMAIL}?subject=ARbixo%20support`} className={linkClass}>
              <span className="text-lg">✉️</span>
              <span>
                <span className="block font-medium text-neutral-900">Contact support</span>
                <span className="block text-xs text-neutral-500">{CONTACT_EMAIL}</span>
              </span>
            </a>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help" : "Open help"}
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white shadow-lg transition-transform hover:scale-105"
      >
        <ArbiAvatar size={56} />
      </button>
    </div>
  );
}
