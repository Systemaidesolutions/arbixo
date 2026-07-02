"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type SearchResult = { type: string; label: string; sub?: string; href: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json().catch(() => ({ results: [] }));
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative hidden sm:block">
      <div className="flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 ring-1 ring-white/15 focus-within:ring-white/40">
        <Search size={15} className="text-white/60" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="w-40 bg-transparent text-sm text-white placeholder-white/50 outline-none lg:w-56"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults([]);
            }}
            aria-label="Clear search"
            className="text-white/60 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 text-neutral-800 shadow-xl">
          {loading ? (
            <div className="px-3 py-2 text-sm text-neutral-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-400">No matches.</div>
          ) : (
            results.map((r, i) => (
              <a
                key={i}
                href={r.href}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
              >
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                  {r.type}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {r.sub && <span className="shrink-0 text-xs text-neutral-400">{r.sub}</span>}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
