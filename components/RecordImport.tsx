"use client";

import { useRef, useState } from "react";

type Row = { row: number; code: string; name: string; action: "create" | "update" | "skip"; detail: string };
type Outcome = { rows: Row[]; issues: { row: number; message: string }[]; canImport: boolean; created: number; updated: number };

const ACTION_STYLE = { create: "bg-green-100 text-green-700", update: "bg-blue-100 text-brand-blue", skip: "bg-red-100 text-red-700" };
const ACTION_LABEL = { create: "New", update: "Update", skip: "Error" };

/**
 * Upload panel for master-record imports: download the Excel template, pick a
 * .xlsx/.csv, preview (dry run) what will be created/updated, then import.
 * Rows with errors are skipped; the rest are saved.
 */
export function RecordImport({ title, endpoint, templateName, onClose, onDone }: {
  title: string; endpoint: string; templateName: string; onClose: () => void; onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "preview" | "import">(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Outcome | null>(null);
  const [done, setDone] = useState<Outcome | null>(null);

  async function send(dryRun: boolean) {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose an .xlsx or .csv file first.");
    setBusy(dryRun ? "preview" : "import"); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (dryRun) fd.append("dryRun", "1");
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Import failed.");
    if (dryRun) { setPreview(data); setDone(null); } else { setDone(data); setPreview(null); onDone(); }
  }

  const shown = done ?? preview;
  const ok = preview ? preview.rows.filter((r) => r.action !== "skip").length : 0;

  return (
    <div className="mb-4 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-neutral-800">{title}</h3>
          <p className="text-xs text-neutral-500">
            Download the Excel template, fill one row per employee (the Instructions sheet explains each column), then upload it.
            Existing codes are updated; blank cells keep the current value.
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-900">Close</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={endpoint} download={templateName} className="rounded border border-brand-blue px-3 py-1.5 text-sm text-brand-blue hover:bg-blue-50">Download Excel template</a>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={() => { setPreview(null); setDone(null); setError(null); }} className="text-sm" />
        <button onClick={() => send(true)} disabled={busy !== null} className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">{busy === "preview" ? "Checking…" : "Preview"}</button>
        {preview?.canImport && (
          <button onClick={() => send(false)} disabled={busy !== null} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
            {busy === "import" ? "Importing…" : `Import ${ok} row(s)`}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {done && (
        <p className={`mt-2 text-sm ${done.issues.length ? "text-amber-700" : "text-green-700"}`}>
          Imported: {done.created} new, {done.updated} updated{done.issues.length ? `, ${done.issues.length} row(s) skipped (see below)` : ""}.
        </p>
      )}
      {preview && (
        <p className="mt-2 text-xs text-neutral-600">
          {preview.rows.filter((r) => r.action === "create").length} new · {preview.rows.filter((r) => r.action === "update").length} update · {preview.issues.length} with errors (skipped)
        </p>
      )}
      {shown && shown.rows.length > 0 && (
        <div className="mt-2 max-h-80 overflow-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-500">
              <tr><th className="px-2 py-1">Row</th><th className="px-2 py-1">Code</th><th className="px-2 py-1">Name</th><th className="px-2 py-1"></th><th className="px-2 py-1">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shown.rows.map((r) => (
                <tr key={r.row} className={r.action === "skip" ? "bg-red-50/50" : ""}>
                  <td className="px-2 py-1 text-neutral-400">{r.row}</td>
                  <td className="px-2 py-1 font-mono">{r.code}</td>
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_STYLE[r.action]}`}>{ACTION_LABEL[r.action]}</span></td>
                  <td className={`px-2 py-1 ${r.action === "skip" ? "text-red-700" : "text-neutral-600"}`}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
