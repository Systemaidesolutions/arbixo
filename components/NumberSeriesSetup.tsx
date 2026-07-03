"use client";

import { useEffect, useState } from "react";
import { NUMBER_SERIES, formatSeriesCode } from "@/lib/numberSeries";

type Series = { entityType: string; prefix: string; nextNumber: number; padding: number };

const LABELS: Record<string, string> = Object.fromEntries(
  NUMBER_SERIES.map((s) => [s.entityType as string, s.label])
);

/**
 * Company-page section for master-data "No. Series". An admin sets each
 * prefix (e.g. CUST); new records are numbered prefix + running 7-digit number.
 */
export function NumberSeriesSetup({ editable }: { editable: boolean }) {
  const [rows, setRows] = useState<Series[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/company/number-series")
      .then((r) => r.json())
      .then((j) => setRows(j.series ?? []))
      .catch(() => setRows([]));
  }, []);

  function setPrefix(entityType: string, prefix: string) {
    setRows((prev) => (prev ? prev.map((r) => (r.entityType === entityType ? { ...r, prefix } : r)) : prev));
    setMsg(null);
  }

  async function save() {
    if (!rows) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/company/number-series", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series: rows.map((r) => ({ entityType: r.entityType, prefix: r.prefix })) }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? "Could not save." });
      return;
    }
    setRows(data.series ?? rows);
    setMsg({ ok: true, text: "Number series saved." });
  }

  return (
    <section className="mt-8">
      <h2 className="text-base font-medium text-neutral-900">Number series</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Set the code prefix for each master-data list. New records are numbered automatically as the
        prefix followed by a 7-digit running number (e.g. <span className="font-mono">CUST0000001</span>),
        incrementing with each record.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Master data</th>
              <th className="px-4 py-2">Prefix</th>
              <th className="px-4 py-2">Next code</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {!rows ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-neutral-400">Loading…</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.entityType}>
                  <td className="px-4 py-2 text-neutral-800">{LABELS[r.entityType] ?? r.entityType}</td>
                  <td className="px-4 py-2">
                    {editable ? (
                      <input
                        value={r.prefix}
                        onChange={(e) => setPrefix(r.entityType, e.target.value.toUpperCase())}
                        maxLength={10}
                        className="w-32 rounded border border-neutral-300 px-2 py-1 font-mono text-sm uppercase"
                      />
                    ) : (
                      <span className="font-mono">{r.prefix}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-neutral-500">
                    {formatSeriesCode(r.prefix, r.nextNumber, r.padding)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !rows}
            className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save number series"}
          </button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
          )}
        </div>
      )}
    </section>
  );
}
