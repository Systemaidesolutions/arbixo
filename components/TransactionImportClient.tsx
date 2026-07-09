"use client";

import { useRef, useState } from "react";
import { formatPeso } from "@/lib/format";

type PreviewRow = { ref: string; date: string; info: string | null; detail: string; amount: number };
type Issue = { row: number | null; ref: string; message: string };
type Preview = { preview: PreviewRow[]; issues: Issue[]; canImport: boolean };
type Result = { results: { ref: string; ok: boolean; error?: string }[]; posted: number; failed: number; issues: Issue[] };

/**
 * Generic Excel/CSV importer UI, shared by every transaction type. `endpoint`
 * handles both preview (dryRun=1) and commit; `templateUrl` downloads the CSV
 * template. `refLabel` is the document-no column label (CV no., Invoice no., …).
 */
export function TransactionImportClient({
  endpoint,
  templateUrl,
  title,
  subtitle,
  refLabel,
}: {
  endpoint: string;
  templateUrl: string;
  title: string;
  subtitle: string;
  refLabel: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "commit">(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function reset() {
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function send(dryRun: boolean) {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .csv or .xlsx file first.");
      return;
    }
    setBusy(dryRun ? "preview" : "commit");
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (dryRun) fd.append("dryRun", "1");
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Import failed.");
      return;
    }
    if (dryRun) {
      setResult(null);
      setPreview(data as Preview);
    } else {
      setResult(data as Result);
      setPreview(null);
    }
  }

  const btn = "rounded px-4 py-2 text-sm disabled:opacity-50";
  const previewTotal = preview?.preview.reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>

      <div className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <a href={templateUrl} download className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
            Download template (.csv)
          </a>
          <span className="text-xs text-neutral-400">Fill it in (Excel .xlsx also accepted), then upload below.</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => { setFileName(e.target.files?.[0]?.name ?? null); reset(); }}
          className="block text-sm"
        />

        <div className="flex items-center gap-2">
          <button onClick={() => send(true)} disabled={!!busy || !fileName} className={`${btn} border border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
            {busy === "preview" ? "Checking…" : "Preview"}
          </button>
          <button onClick={() => send(false)} disabled={!!busy || !preview?.canImport} className={`${btn} bg-[#0B2A5E] text-white hover:bg-[#123A73]`}>
            {busy === "commit" ? "Importing…" : preview ? `Import ${preview.preview.length} document(s)` : "Import"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {preview && (
        <div className="mt-6 space-y-4">
          {preview.issues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">{preview.issues.length} issue(s) found — fix these rows and re-upload:</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {preview.issues.map((it, i) => (
                  <li key={i}>{it.row ? `Row ${it.row}` : "—"}{it.ref ? ` (${it.ref})` : ""}: {it.message}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.preview.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-3 py-2">{refLabel}</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Party</th>
                    <th className="px-3 py-2">Detail</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {preview.preview.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.ref}</td>
                      <td className="px-3 py-1.5">{r.date}</td>
                      <td className="px-3 py-1.5">{r.info ?? "—"}</td>
                      <td className="px-3 py-1.5 text-xs text-neutral-500">{r.detail}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatPeso(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-50 font-medium">
                    <td className="px-3 py-2" colSpan={4}>{preview.preview.length} document(s) ready</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPeso(previewTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No valid documents to import.</p>
          )}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-3">
          <div className={`rounded-lg border p-4 ${result.failed === 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-medium text-neutral-800">
              Imported {result.posted} document(s){result.failed > 0 ? `, ${result.failed} failed` : ""}.
            </p>
          </div>
          {result.results.some((r) => !r.ok) && (
            <ul className="space-y-1 text-xs text-red-700">
              {result.results.filter((r) => !r.ok).map((r, i) => (<li key={i}>{r.ref}: {r.error}</li>))}
            </ul>
          )}
          {result.issues.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-800">
              {result.issues.map((it, i) => (<li key={i}>{it.row ? `Row ${it.row}` : "—"}{it.ref ? ` (${it.ref})` : ""}: {it.message}</li>))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
