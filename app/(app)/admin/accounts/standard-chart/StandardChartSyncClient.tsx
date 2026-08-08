"use client";

import { useState } from "react";

type Conflict = {
  code: string;
  standardTitle: string;
  existingAccountId: string;
  existingTitle: string;
  hasActivity: boolean;
};

type Result = {
  companyId: string;
  companyName: string;
  created: number;
  conflicts: Conflict[];
};

export function StandardChartSyncClient() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/accounts/standard-chart", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j?.error ?? "Could not sync the standard chart.");
      return;
    }
    setResults(j.results as Result[]);
  }

  const totalCreated = results?.reduce((s, r) => s + r.created, 0) ?? 0;
  const totalConflicts = results?.reduce((s, r) => s + r.conflicts.length, 0) ?? 0;

  return (
    <section className="mt-6">
      <button
        onClick={run}
        disabled={busy}
        className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
      >
        {busy ? "Applying…" : "Apply standard chart to all companies"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm text-neutral-600">
            Added <span className="font-medium text-neutral-900">{totalCreated}</span> account{totalCreated === 1 ? "" : "s"} across{" "}
            {results.length} companies.{" "}
            {totalConflicts > 0 && (
              <span className="text-amber-700">
                {totalConflicts} code{totalConflicts === 1 ? "" : "s"} already existed under a different name — review below.
              </span>
            )}
          </p>

          <div className="mt-3 space-y-3">
            {results.map((r) => (
              <div key={r.companyId} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-800">{r.companyName}</span>
                  <span className="text-xs text-neutral-500">
                    {r.created} added{r.conflicts.length > 0 ? ` · ${r.conflicts.length} conflicts` : ""}
                  </span>
                </div>
                {r.conflicts.length > 0 && (
                  <table className="mt-2 w-full text-xs">
                    <thead>
                      <tr className="text-left text-neutral-400">
                        <th className="py-1 pr-2 font-normal">Code</th>
                        <th className="py-1 pr-2 font-normal">Existing title</th>
                        <th className="py-1 pr-2 font-normal">Standard title</th>
                        <th className="py-1 font-normal">Has entries?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.conflicts.map((c) => (
                        <tr key={c.code} className="border-t border-neutral-100">
                          <td className="py-1 pr-2 font-mono">{c.code}</td>
                          <td className="py-1 pr-2">{c.existingTitle}</td>
                          <td className="py-1 pr-2">{c.standardTitle}</td>
                          <td className="py-1">
                            {c.hasActivity ? (
                              <span className="text-red-600">Yes — do not delete</span>
                            ) : (
                              <span className="text-neutral-400">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
