"use client";

import { useState } from "react";

type Company = { id: string; tradeName: string };

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
  deletedCount?: number;
  keptAccounts?: KeptAccount[];
};

export function StandardChartSyncClient({ companies }: { companies: Company[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState<"sync" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(requestMode: "sync" | "reset") {
    setConfirmingReset(false);
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/accounts/standard-chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, mode: requestMode }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j?.error ?? "Could not update the chart of accounts.");
      return;
    }
    setMode(requestMode);
    setResult(j.result as Result);
  }

  const selected = companies.find((c) => c.id === companyId);
  const keptCount = result?.keptAccounts?.length ?? 0;

  return (
    <section className="mt-6">
      <label className="block text-xs text-neutral-500">
        Company
        <select
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setResult(null);
            setError(null);
            setConfirmingReset(false);
          }}
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm sm:max-w-sm"
        >
          {companies.length === 0 && <option value="">No companies yet</option>}
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.tradeName}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => run("sync")}
          disabled={busy || !companyId}
          className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
        >
          {busy && mode === "sync" ? "Adding missing accounts…" : "Add missing standard accounts"}
        </button>

        {!confirmingReset ? (
          <button
            onClick={() => setConfirmingReset(true)}
            disabled={busy || !companyId}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete and rebuild this company&apos;s chart
          </button>
        ) : (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">
              This deletes every account in <span className="font-medium">{selected?.tradeName}</span>&apos;s chart
              of accounts and replaces it with only the standard chart. An account still in use — it has ledger
              entries, a child account, or is referenced by a tax-posting setup — can&apos;t be deleted and will be
              listed afterward instead. This can&apos;t be undone for accounts that do get deleted. Continue?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => run("reset")}
                disabled={busy}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy && mode === "reset" ? "Resetting…" : "Yes, delete and rebuild"}
              </button>
              <button
                onClick={() => setConfirmingReset(false)}
                disabled={busy}
                className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-neutral-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800">{result.companyName}</span>
            <span className="text-xs text-neutral-500">
              {mode === "reset" ? `${result.deletedCount ?? 0} deleted · ` : ""}
              {result.created} added
              {keptCount > 0 ? ` · ${keptCount} kept` : ""}
              {result.conflicts.length > 0 ? ` · ${result.conflicts.length} conflicts` : ""}
            </span>
          </div>
          {result.created === 0 && result.conflicts.length === 0 && keptCount === 0 && (
            <p className="mt-1 text-xs text-neutral-500">Already up to date — nothing to add.</p>
          )}
          {keptCount > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              Kept (still in use): {result.keptAccounts!.map((a) => `${a.code} ${a.title}`).join(", ")}
            </p>
          )}
          {result.conflicts.length > 0 && (
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
                {result.conflicts.map((c) => (
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
      )}
    </section>
  );
}
