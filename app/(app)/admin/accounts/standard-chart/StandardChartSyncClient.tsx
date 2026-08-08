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
  droppedOldCodes: string[];
  keptOldCodes: string[];
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
      setError(j?.error ?? "Could not migrate the standard chart.");
      return;
    }
    setResults(j.results as Result[]);
  }

  const totalCreated = results?.reduce((s, r) => s + r.created, 0) ?? 0;
  const totalDropped = results?.reduce((s, r) => s + r.droppedOldCodes.length, 0) ?? 0;
  const totalKept = results?.reduce((s, r) => s + r.keptOldCodes.length, 0) ?? 0;
  const totalConflicts = results?.reduce((s, r) => s + r.conflicts.length, 0) ?? 0;

  return (
    <section className="mt-6">
      <button
        onClick={run}
        disabled={busy}
        className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
      >
        {busy ? "Migrating…" : "Migrate all companies to the new codes"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm text-neutral-600">
            Old codes dropped: <span className="font-medium text-neutral-900">{totalDropped}</span>. New accounts added:{" "}
            <span className="font-medium text-neutral-900">{totalCreated}</span>. Across {results.length} companies.
          </p>
          {(totalKept > 0 || totalConflicts > 0) && (
            <p className="mt-1 text-sm text-amber-700">
              {totalKept > 0 && <>{totalKept} old account{totalKept === 1 ? "" : "s"} couldn&apos;t be dropped (still in use).</>}{" "}
              {totalConflicts > 0 && (
                <>
                  {totalConflicts} standard code{totalConflicts === 1 ? "" : "s"} collide with an existing account under a
                  different name — review below.
                </>
              )}
            </p>
          )}

          <div className="mt-3 space-y-3">
            {results.map((r) => (
              <div key={r.companyId} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-800">{r.companyName}</span>
                  <span className="text-xs text-neutral-500">
                    {r.droppedOldCodes.length} dropped · {r.created} added
                    {r.keptOldCodes.length > 0 ? ` · ${r.keptOldCodes.length} kept` : ""}
                    {r.conflicts.length > 0 ? ` · ${r.conflicts.length} conflicts` : ""}
                  </span>
                </div>
                {r.keptOldCodes.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Kept (still has children or ledger entries): {r.keptOldCodes.join(", ")}
                  </p>
                )}
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
