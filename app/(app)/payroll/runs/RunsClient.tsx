"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";
import { FREQUENCY_LABEL, type PayFrequency } from "@/lib/payroll/compute";

type Run = { id: string; runNo: string; group: string; periodStart: string; periodEnd: string; payDate: string; status: "DRAFT" | "POSTED" | "CANCELLED"; employees: number; totalGross: number; totalNet: number; branch: string | null };
type Group = { id: string; name: string; frequency: PayFrequency };

const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const label = "block text-xs text-neutral-500";
const mdy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const STATUS_BADGE: Record<Run["status"], string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  POSTED: "bg-green-100 text-green-700",
  CANCELLED: "bg-neutral-100 text-neutral-500",
};

/** Suggests the current period for a frequency (1–15 / 16–end, Mon–Sun, whole month, or today). */
function suggestPeriod(freq: PayFrequency): { start: string; end: string } {
  const t = new Date();
  if (freq === "MONTHLY") return { start: iso(new Date(t.getFullYear(), t.getMonth(), 1)), end: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
  if (freq === "SEMI_MONTHLY") return t.getDate() <= 15
    ? { start: iso(new Date(t.getFullYear(), t.getMonth(), 1)), end: iso(new Date(t.getFullYear(), t.getMonth(), 15)) }
    : { start: iso(new Date(t.getFullYear(), t.getMonth(), 16)), end: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
  if (freq === "WEEKLY") {
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: iso(mon), end: iso(sun) };
  }
  return { start: iso(t), end: iso(t) };
}

export function RunsClient({ runs, groups, branches, canEdit }: { runs: Run[]; groups: Group[]; branches: { id: string; name: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payGroupId: "", periodStart: "", periodEnd: "", payDate: "", locationId: "", remarks: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickGroup(id: string) {
    const g = groups.find((x) => x.id === id);
    if (!g) return setForm({ ...form, payGroupId: id });
    const p = suggestPeriod(g.frequency);
    setForm({ ...form, payGroupId: id, periodStart: p.start, periodEnd: p.end, payDate: form.payDate || p.end });
  }

  async function create() {
    setBusy(true); setError(null);
    const res = await fetch("/api/payroll/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error ?? "Could not create the run.");
    router.push(`/payroll/runs/${d.run.id}`);
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <section className="rounded-lg border border-neutral-200 p-4">
          {!open ? (
            <button onClick={() => setOpen(true)} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight">+ New payroll run</button>
          ) : (
            <>
              <h2 className="text-sm font-medium text-neutral-800">New payroll run</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <label className={`${label} sm:col-span-2`}>Pay group
                  <select value={form.payGroupId} onChange={(e) => pickGroup(e.target.value)} className={field}>
                    <option value="">Select…</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({FREQUENCY_LABEL[g.frequency]})</option>)}
                  </select>
                </label>
                <label className={label}>Period from<input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} className={field} /></label>
                <label className={label}>Period to<input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} className={field} /></label>
                <label className={label}>Pay date<input type="date" value={form.payDate} onChange={(e) => setForm({ ...form, payDate: e.target.value })} className={field} /></label>
                <label className={`${label} sm:col-span-2`}>Branch (optional — only employees of this branch)
                  <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={field}>
                    <option value="">All branches</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <label className={`${label} sm:col-span-3`}>Remarks<input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={field} /></label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={create} disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">Create run</button>
                <button onClick={() => setOpen(false)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
                {error && <span className="text-xs text-red-600">{error}</span>}
              </div>
            </>
          )}
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-800">Runs ({runs.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-3">Run no.</th><th className="py-2 pr-3">Pay group</th><th className="py-2 pr-3">Period</th><th className="py-2 pr-3">Pay date</th>
                <th className="py-2 pr-3 text-right">Employees</th><th className="py-2 pr-3 text-right">Gross</th><th className="py-2 pr-3 text-right">Net</th><th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {runs.length === 0 && <tr><td colSpan={8} className="py-3 text-neutral-400">No payroll runs yet.</td></tr>}
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="py-1.5 pr-3 font-mono text-xs"><Link href={`/payroll/runs/${r.id}`} className="text-brand-blue hover:underline">{r.runNo}</Link></td>
                  <td className="py-1.5 pr-3">{r.group}{r.branch && <span className="ml-1 text-xs text-neutral-400">· {r.branch}</span>}</td>
                  <td className="py-1.5 pr-3 text-xs">{mdy(r.periodStart)} – {mdy(r.periodEnd)}</td>
                  <td className="py-1.5 pr-3 text-xs">{mdy(r.payDate)}</td>
                  <td className="py-1.5 pr-3 text-right">{r.employees}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{formatPeso(r.totalGross)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{formatPeso(r.totalNet)}</td>
                  <td className="py-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
