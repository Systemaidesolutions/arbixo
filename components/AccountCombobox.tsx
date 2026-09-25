"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type AccountLike = { id: string; code: string; title: string; classification?: string | null };

const classLabel = (c?: string | null) => (c ? c.replace(/_/g, " ").toLowerCase() : "");
const displayLabel = (a: AccountLike) => `${a.code} — ${a.title}`;
const searchBlob = (a: AccountLike) => `${a.code} ${a.title} ${classLabel(a.classification)}`.toLowerCase();

// Type-to-search replacement for the account <select>: matches code, title or
// classification; arrow keys + Enter (or click) select. The list is fixed-
// positioned so it isn't clipped by the scrolling lines table.
export function AccountCombobox({
  accounts,
  value,
  onChange,
  required,
  disabled,
  className = "",
  placeholder = "Type code or name…",
}: {
  accounts: AccountLike[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const selected = value ? accounts.find((a) => a.id === value) : undefined;

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return accounts;
    return accounts.filter((a) => {
      const blob = searchBlob(a);
      return words.every((w) => blob.includes(w));
    });
  }, [accounts, query]);

  useEffect(() => setHighlight(0), [query, open]);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  // Native "required" can't see the selection while the box shows search text,
  // so mirror it through the validity message instead.
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !selected ? "Select an account from the list." : "");
  }, [required, selected]);

  function place() {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.bottom + 2, width: r.width });
  }
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  function pick(a: AccountLike) {
    onChange(a.id);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "ArrowDown") { setHighlight((h) => Math.min(h + 1, filtered.length - 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setHighlight((h) => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === "Enter") { e.preventDefault(); const a = filtered[highlight]; if (a) pick(a); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); setQuery(""); }
  }

  return (
    <>
      <input
        ref={inputRef}
        disabled={disabled}
        value={open ? query : selected ? displayLabel(selected) : ""}
        title={selected ? displayLabel(selected) : undefined}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={(e) => { setQuery(""); setOpen(true); e.currentTarget.select(); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`${className} disabled:bg-neutral-100`}
      />
      {open && rect && (
        <div
          style={{ position: "fixed", left: rect.left, top: rect.top, minWidth: Math.max(rect.width, 360), zIndex: 60 }}
          className="max-h-64 overflow-auto rounded border border-neutral-300 bg-white text-xs shadow-lg"
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-2 text-neutral-400">No matching accounts</div>
          ) : (
            filtered.map((a, i) => (
              <button
                type="button"
                key={a.id}
                onMouseDown={(e) => { e.preventDefault(); pick(a); }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-3 px-2 py-1.5 text-left ${i === highlight ? "bg-blue-50" : "hover:bg-neutral-50"}`}
              >
                <span className="w-20 shrink-0 font-mono text-neutral-500">{a.code}</span>
                <span className="flex-1 truncate text-neutral-900">{a.title}</span>
                {a.classification && <span className="shrink-0 text-[10px] capitalize text-neutral-400">{classLabel(a.classification)}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}
