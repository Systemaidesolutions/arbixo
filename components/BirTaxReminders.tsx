"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

type Reminder = { date: string; category: string; description: string };
type Payload = {
  ok: boolean;
  year: number;
  month: number;
  monthLabel: string;
  entries: Reminder[];
  stale?: boolean;
};

// Today in Philippine time (UTC+8), as YYYY-MM-DD.
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dayNum(iso: string): number {
  return Number(iso.slice(8, 10));
}

// Keys match the normalized buckets from lib/birTaxCalendar.ts.
const CATEGORY_STYLE: Record<string, string> = {
  "FILING & PAYMENT": "bg-red-50 text-red-700",
  PAYMENT: "bg-red-50 text-red-700",
  FILING: "bg-blue-50 text-blue-700",
  SUBMISSION: "bg-amber-50 text-amber-700",
  REGISTRATION: "bg-green-50 text-green-700",
  DISTRIBUTION: "bg-purple-50 text-purple-700",
};

export function BirTaxReminders({ initialYear, initialMonth }: { initialYear: number; initialMonth: number }) {
  const [ym, setYm] = useState({ year: initialYear, month: initialMonth });
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetch(`/api/bir/tax-calendar?year=${ym.year}&month=${ym.month}`)
      .then((r) => r.json())
      .then((d: Payload) => {
        if (!active) return;
        setData(d);
        setFailed(!d.ok);
      })
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ym]);

  function shift(delta: number) {
    setYm((cur) => {
      const m = cur.month + delta;
      if (m < 1) return { year: cur.year - 1, month: 12 };
      if (m > 12) return { year: cur.year + 1, month: 1 };
      return { year: cur.year, month: m };
    });
  }

  const today = phToday();
  const isCurrentMonth = today.startsWith(`${ym.year}-${String(ym.month).padStart(2, "0")}`);
  const entries = data?.entries ?? [];

  return (
    <section className="rounded-xl border border-white/40 bg-white/50 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">BIR Tax Reminders</div>
          <div className="mt-0.5 text-sm font-medium text-neutral-700">{data?.monthLabel ?? "…"}</div>
        </div>
        <div className="flex items-center gap-1 print:hidden">
          <button
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => shift(1)}
            aria-label="Next month"
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid max-h-96 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {loading ? (
          <p className="col-span-full py-6 text-center text-sm text-neutral-400">Loading BIR reminders…</p>
        ) : failed ? (
          <p className="col-span-full py-6 text-center text-sm text-neutral-400">
            Couldn&apos;t reach the BIR calendar right now.
          </p>
        ) : entries.length === 0 ? (
          <p className="col-span-full py-6 text-center text-sm text-neutral-400">No BIR deadlines listed for this month.</p>
        ) : (
          entries.map((e, i) => {
            const passed = isCurrentMonth && e.date < today;
            const isToday = e.date === today;
            return (
              <div
                key={`${e.date}-${i}`}
                className={`flex gap-3 rounded-lg border p-2.5 ${
                  isToday ? "border-brand-blue/40 bg-blue-50/40" : "border-neutral-200 bg-white/60"
                } ${passed ? "opacity-50" : ""}`}
              >
                <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-md bg-neutral-100 py-1">
                  <span className="text-base font-bold leading-none text-neutral-800">{dayNum(e.date)}</span>
                  <span className="text-[9px] uppercase tracking-wide text-neutral-400">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>
                <div className="min-w-0">
                  {e.category && (
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        CATEGORY_STYLE[e.category] ?? "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {e.category}
                    </span>
                  )}
                  <p className="mt-1 text-xs leading-snug text-neutral-600">{e.description}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <a
        href="https://www.bir.gov.ph/Tax-Reminder"
        target="_blank"
        rel="noopener noreferrer"
        data-no-stack
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
      >
        View full calendar on BIR.gov.ph
        <ExternalLink size={12} />
      </a>
    </section>
  );
}
