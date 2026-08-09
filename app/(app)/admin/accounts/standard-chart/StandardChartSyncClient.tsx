"use client";

import { useState } from "react";

type Conflict = {
  code: string;
  standardTitle: string;
  existingAccountId: string;
  existingTitle: string;
  hasActivity: boolean;
};

type KeptAccount = { code: string; title: string };

type Result = {
  companyId: string;
  companyName: string;
  created: number;
  conflicts: Conflict[];
  deletedCount: number;
  keptAccounts: KeptAccount[];
};

export function StandardChartSyncClient() {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setConfirming(false);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/accounts/standard-chart", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j?.error ?? "Could not reset the chart of accounts.");
      return;
    }
    setResults(j.results as Result[]);
  }

  const totalDeleted = results?.reduce((s, r) => s + r.deletedCount, 0) ?? 0;
  const totalCreated = results?.reduce((s, r) => s + r.created, 0) ?? 0;
  const totalKept = results?.reduce((s, r) => s + r.keptAccounts.length, 0) ?? 0;
  const totalConflicts = results?.reduce((s, r) => s + r.conflicts.length, 0) ?? 0;

  return (
    <section className="mt-6">
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          Delete all charts of accounts and rebuild from the standard chart
        </button>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            This deletes every account in every company&apos;s chart of accounts and replaces it with only
            the new standard chart. An account still in use — it has ledger entries, a child account, or is
            referenced by a tax-posting setup — can&apos;t be deleted and will be listed afterward instead.
            This can&apos;t be undone for accounts that do get deleted. Continue?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={run}
              disabled={busy}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Resetting…" : "Yes, delete and rebuild"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm text-neutral-600">
            Deleted <span className="font-medium text-neutral-900">{totalDeleted}</span>, added{" "}
            <span className="font-medium text-neutral-900">{totalCreated}</span> across {results.length} companies.
          </p>
          {(totalKept > 0 || totalConflicts > 0) && (
            <p className="mt-1 text-sm text-amber-700">
              {totalKept > 0 && <>{totalKept} account{totalKept === 1 ? "" : "s"} couldn&apos;t be deleted (still in use).</>}{" "}
              {totalConflicts > 0 && (
                <>
                  {totalConflicts} standard code{totalConflicts === 1 ? "" : "s"} collide with a kept account under a
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
                    {r.deletedCount} deleted · {r.created} added
                    {r.keptAccounts.length > 0 ? ` · ${r.keptAccounts.length} kept` : ""}
                    {r.conflicts.length > 0 ? ` · ${r.conflicts.length} conflicts` : ""}
                  </span>
                </div>
                {r.keptAccounts.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Kept (still in use): {r.keptAccounts.map((a) => `${a.code} ${a.title}`).join(", ")}
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
