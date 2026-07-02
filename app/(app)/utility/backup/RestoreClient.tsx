"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ParsedBackup = {
  raw: unknown;
  backupType: "company" | "database";
  title: string;
  summary: string;
};

function summarize(data: Record<string, unknown>): ParsedBackup | null {
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  if (data.backupType === "company") {
    const company = data.company as { tradeName?: string } | undefined;
    return {
      raw: data,
      backupType: "company",
      title: company?.tradeName ?? "(unnamed company)",
      summary: `${len(data.accounts)} accounts · ${len(data.customers) + len(data.vendors) + len(data.employees) + len(data.contacts)} agents · ${len(data.ledgerEntries)} ledger entries`,
    };
  }
  if (data.backupType === "database") {
    return {
      raw: data,
      backupType: "database",
      title: "Whole database",
      summary: `${len(data.companies)} companies · ${len(data.ledgerEntries)} ledger entries`,
    };
  }
  return null;
}

export function RestoreClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setParsed(null);
    setDone(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      const p = summarize(data);
      if (!p) {
        setError("This file doesn't look like an Arbixo backup.");
        return;
      }
      if (p.backupType === "database" && !isAdmin) {
        setError("Only an administrator can restore a whole-database backup.");
        return;
      }
      setParsed(p);
    } catch {
      setError("Couldn't read that file — is it a valid .json backup?");
    }
  }

  async function doRestore() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    const url =
      parsed.backupType === "company"
        ? "/api/utility/restore/company"
        : "/api/utility/restore/database";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.raw),
    });
    setBusy(false);
    setConfirming(false);
    setAcknowledged(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Restore failed.");
      return;
    }
    setDone(`Restore complete — "${parsed.title}" was overwritten from the backup.`);
    setParsed(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <h2 className="text-sm font-semibold text-neutral-800">Restore from backup</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Upload a backup <code>.json</code> file. Restoring{" "}
        <span className="font-semibold text-amber-700">overwrites</span> existing data — it can&apos;t
        be undone. User accounts and passwords are never changed.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        className="mt-3 block w-full text-sm text-neutral-600 file:mr-3 file:rounded file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {done && (
        <p className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {done}
        </p>
      )}

      {parsed && (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="text-sm font-medium text-neutral-800">
            {parsed.backupType === "company" ? "Company backup" : "Whole-database backup"}:{" "}
            {parsed.title}
          </div>
          <div className="text-xs text-neutral-500">{parsed.summary}</div>
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Restore (overwrite)…
          </button>
        </div>
      )}

      {/* Confirmation modal — deliberate friction to avoid accidental restores */}
      {confirming && parsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirming(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-red-700">Overwrite data?</h3>
            <p className="mt-2 text-sm text-neutral-700">
              This will <span className="font-semibold">permanently overwrite</span>{" "}
              {parsed.backupType === "database" ? (
                <>all companies and their data</>
              ) : (
                <>
                  all data for <span className="font-semibold">{parsed.title}</span>
                </>
              )}{" "}
              with the contents of this backup. Current data will be lost and this{" "}
              <span className="font-semibold">cannot be undone</span>.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              I understand this permanently overwrites existing data.
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirming(false);
                  setAcknowledged(false);
                }}
                className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={doRestore}
                disabled={!acknowledged || busy}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? "Restoring…" : "Overwrite now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
