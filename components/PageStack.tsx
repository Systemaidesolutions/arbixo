"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X } from "lucide-react";

type Entry = { id: string; href: string; title: string };

type PageStackApi = {
  stack: Entry[];
  open: (href: string, title: string) => void;
  close: (id?: string) => void;
  closeAll: () => void;
};

const Ctx = createContext<PageStackApi | null>(null);

/** Opens internal pages as stacked modal overlays (Business-Central style):
 * a page opens on top of the current one, and closing returns to it. Any depth. */
export function usePageStack(): PageStackApi | null {
  return useContext(Ctx);
}

function withEmbed(href: string): string {
  const [base, hash] = href.split("#");
  const [path, query] = base.split("?");
  const params = new URLSearchParams(query);
  params.set("_embed", "1");
  return `${path}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

export function PageStackProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([]);

  const open = useCallback((href: string, title: string) => {
    setStack((s) => {
      // Ignore an immediate duplicate of the top page.
      if (s.length && s[s.length - 1].href === href) return s;
      const id = (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 12);
      return [...s, { id, href, title: title || "Page" }];
    });
  }, []);

  // Close a specific panel (and everything stacked above it), or the top one.
  const close = useCallback((id?: string) => {
    setStack((s) => {
      if (!s.length) return s;
      if (!id) return s.slice(0, -1);
      const idx = s.findIndex((e) => e.id === id);
      return idx === -1 ? s : s.slice(0, idx);
    });
  }, []);

  const closeAll = useCallback(() => setStack([]), []);

  // Messages from embedded (iframed) pages: open a deeper page, or close self.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (d?.type === "stack:open" && typeof d.href === "string") open(d.href, d.title ?? "");
      else if (d?.type === "stack:close") close();
      else if (d?.type === "stack:closeAll") closeAll();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [open, close, closeAll]);

  // ESC closes the top page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && stack.length) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stack.length, close]);

  return (
    <Ctx.Provider value={{ stack, open, close, closeAll }}>
      {children}
      {/* Overlays start to the RIGHT of the sidebar (lg:left-64) so the
          navigation stays visible and clickable — you can open another page on
          top while one is open, Business-Central style. */}
      {stack.map((e, i) => (
        <div key={e.id} className="fixed inset-y-0 left-0 right-0 lg:left-64 print:hidden" style={{ zIndex: 50 + i }}>
          <div className="absolute inset-0 bg-black/10" onClick={() => close(e.id)} aria-hidden />
          <div
            className="absolute flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10"
            style={{ top: `${8 + i * 10}px`, left: `${8 + i * 10}px`, right: "8px", bottom: "8px" }}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
              <span className="truncate text-sm font-medium text-neutral-800">{e.title}</span>
              <button
                onClick={() => close(e.id)}
                aria-label="Close"
                className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
              >
                <X size={16} />
              </button>
            </div>
            <iframe src={withEmbed(e.href)} title={e.title} className="min-h-0 w-full flex-1" />
          </div>
        </div>
      ))}
    </Ctx.Provider>
  );
}

/**
 * Rendered inside embedded (iframed) pages. Intercepts internal link clicks so
 * they open a NEW page on the parent's stack (deeper) instead of navigating
 * inside the iframe — this is what makes the stack go arbitrarily deep.
 */
export function EmbedLinkInterceptor() {
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      const a = (ev.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (
        !href.startsWith("/") || // only internal, root-relative links
        href.startsWith("//") ||
        a.target === "_blank" ||
        a.hasAttribute("download") ||
        a.dataset.noStack !== undefined
      ) {
        return;
      }
      ev.preventDefault();
      window.parent?.postMessage(
        { type: "stack:open", href, title: (a.textContent || "").trim() || "Page" },
        window.location.origin
      );
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
