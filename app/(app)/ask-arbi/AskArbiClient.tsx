"use client";

import { useState } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { ASK_EXAMPLES } from "@/lib/askArbi";

type AskTable = {
  columns: string[];
  align?: ("left" | "right")[];
  rows: (string | number | null)[][];
  totals?: (string | number | null)[];
  note?: string;
};
type AskResult = {
  engine?: "rule" | "ai";
  report?: { id: string; label: string; href: string; category: string };
  from?: string;
  to?: string;
  periodLabel?: string;
  table?: AskTable | null;
  error?: string;
  suggestions?: string[];
};

export function AskArbiClient() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      setResult(await res.json());
    } catch {
      setResult({ error: "Couldn't reach the server. Try again." });
    } finally {
      setLoading(false);
    }
  }

  const cell = "border-b border-neutral-100 px-3 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-[#1668c9] text-white shadow-sm">
          <Sparkles size={18} />
        </span>
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Ask ARbi</h1>
          <p className="text-sm text-neutral-500">Ask for a report in plain language and I&apos;ll generate it.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(query);
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="e.g. Generate a Cash Disbursement report for the current month"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="shrink-0 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1668c9] disabled:opacity-40"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {!result && !loading && (
        <div className="mt-4 flex flex-wrap gap-2">
          {ASK_EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuery(ex);
                ask(ex);
              }}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 hover:border-brand-blue hover:text-brand-blue"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-neutral-400">Generating your report…</p>}

      {result?.error && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {result.error}
          {result.suggestions && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.suggestions.map((s) => (
                <span key={s} className="rounded-full bg-white px-2 py-0.5 text-xs text-amber-700 ring-1 ring-amber-200">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {result?.report && (
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-neutral-800">{result.report.label}</div>
              <div className="text-xs text-neutral-500">
                {result.periodLabel}
                <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                  {result.engine === "ai" ? "AI" : "matched"}
                </span>
              </div>
            </div>
            <a
              href={result.report.href}
              className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Open full report <ArrowUpRight size={14} />
            </a>
          </div>

          {result.table ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    {result.table.columns.map((c, i) => (
                      <th key={i} className={`px-3 py-2 ${result.table!.align?.[i] === "right" ? "text-right" : ""}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.table.rows.length === 0 ? (
                    <tr><td className={`${cell} text-center text-neutral-400`} colSpan={result.table.columns.length}>No data for this period</td></tr>
                  ) : (
                    result.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((v, ci) => (
                          <td key={ci} className={`${cell} ${result.table!.align?.[ci] === "right" ? "text-right font-mono whitespace-nowrap" : ""}`}>{v}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {result.table.totals && (
                  <tfoot>
                    <tr className="bg-neutral-50 font-semibold">
                      {result.table.totals.map((v, ci) => (
                        <td key={ci} className={`px-3 py-2 text-sm ${result.table!.align?.[ci] === "right" ? "text-right font-mono whitespace-nowrap" : ""}`}>{v}</td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-neutral-500">
              This report doesn&apos;t have an inline preview yet — use <span className="font-medium">Open full report</span> above to view it with all its options.
            </div>
          )}

          {result.table?.note && <div className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-400">{result.table.note}</div>}
        </div>
      )}
    </main>
  );
}
