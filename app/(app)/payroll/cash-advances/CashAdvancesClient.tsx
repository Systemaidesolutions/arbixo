"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type History = { runId: string; runNo: string; status: string; payDate: string; amount: number };
type Row = {
  id: string; employeeId: string; employee: string; employeeCode: string; date: string; startDate: string; reference: string; description: string;
  amount: number; installment: number; deducted: number; balance: number; status: "ACTIVE" | "PAID" | "CANCELLED"; note: string | null; history: History[];
};
type Form = { id: string | null; employeeId: string; date: string; amount: string; installment: string; startDate: string; reference: string; description: string };

const peso = (v: number) => `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const label = "block text-xs text-neutral-500";
const btn = "rounded border px-2 py-1 text-xs font-medium disabled:opacity-40";
const STATUS: Record<Row["status"], [string, string]> = {
  ACTIVE: ["Active", "bg-amber-100 text-amber-800"],
  PAID: ["Paid", "bg-green-100 text-green-800"],
  CANCELLED: ["Cancelled", "bg-neutral-200 text-neutral-600"],
};
const TABS: [string, string][] = [["ACTIVE", "Active"], ["PAID", "Paid"], ["CANCELLED", "Cancelled"], ["ALL", "All"]];
const blank = (): Form => ({ id: null, employeeId: "", date: today(), amount: "", installment: "", startDate: "", reference: "", description: "" });

export function CashAdvancesClient({ canEdit, tab, outstanding, activeCount, employees, rows }: {
  canEdit: boolean; tab: string; outstanding: number; activeCount: number; employees: { id: string; label: string }[]; rows: Row[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const amount = Number(form?.amount) || 0;
  const inst = Number(form?.installment) || 0;
  const runs = amount > 0 && inst > 0 ? Math.ceil(amount / inst) : 0;

  async function save() {
    if (!form) return;
    setBusy("form");
    setMsg(null);
    const res = await fetch(form.id ? `/api/payroll/cash-advances/${form.id}` : "/api/payroll/cash-advances", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount), installment: Number(form.installment) }),
    }).catch(() => null);
    setBusy(null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setMsg({ ok: false, text: data.error ?? "Couldn't save." });
    setMsg({ ok: true, text: form.id ? "Cash advance updated." : "Cash advance recorded. It will be deducted starting with the next payroll run." });
    setForm(null);
    router.refresh();
  }

  async function act(r: Row, action: "cancel" | "reactivate" | "delete") {
    let note: string | null = null;
    if (action === "cancel") {
      note = prompt(`Stop deducting ${r.employee}'s cash advance (balance ${peso(r.balance)})? Deductions already posted stay. Reason (optional):`, "");
      if (note === null) return;
    } else if (action === "delete" && !confirm(`Delete ${r.employee}'s ${peso(r.amount)} cash advance? Use this only for one recorded by mistake.`)) return;
    setBusy(r.id);
    setMsg(null);
    const res = await fetch(`/api/payroll/cash-advances/${r.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    }).catch(() => null);
    setBusy(null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setMsg({ ok: false, text: data.error ?? "Something went wrong." });
    setMsg({ ok: true, text: { cancel: "Cancelled", reactivate: "Reactivated", delete: "Deleted" }[action] + `: ${r.employee}.` });
    router.refresh();
  }

  const shown = rows.filter((r) => !q || `${r.employee} ${r.employeeCode} ${r.reference}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="text-xs text-neutral-500">Outstanding (active)</div>
          <div className="text-lg font-semibold text-neutral-900">{peso(outstanding)}</div>
          <div className="text-xs text-neutral-500">{activeCount} cash advance(s)</div>
        </div>
        {canEdit && !form && (
          <button onClick={() => { setForm(blank()); setMsg(null); }} className="ml-auto rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight">
            + New cash advance
          </button>
        )}
      </div>

      {form && (
        <div className="mt-4 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-4">
          <h2 className="text-sm font-medium text-neutral-800">{form.id ? "Edit cash advance" : "New cash advance"}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className={`${label} sm:col-span-2`}>Employee
              <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={field}>
                <option value="">Select…</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </label>
            <label className={label}>Date given<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} /></label>
            <label className={label}>Reference (optional)<input value={form.reference} maxLength={60} placeholder="e.g. CV-0012" onChange={(e) => setForm({ ...form, reference: e.target.value })} className={field} /></label>
            <label className={label}>Amount<input value={form.amount} inputMode="decimal" onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${field} text-right font-mono`} /></label>
            <label className={label}>Deduct per payroll run<input value={form.installment} inputMode="decimal" onChange={(e) => setForm({ ...form, installment: e.target.value })} className={`${field} text-right font-mono`} /></label>
            <label className={label}>Start deducting on (optional)<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={field} /></label>
            <div className="flex items-end pb-1.5 text-xs text-neutral-500">
              {runs > 0 ? `About ${runs} payroll run${runs === 1 ? "" : "s"} to pay back.` : "Blank start date: from the next payroll run."}
            </div>
            <label className={`${label} sm:col-span-4`}>Details (optional)<input value={form.description} maxLength={300} placeholder="e.g. Emergency, hospital bill" onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} /></label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={save} disabled={busy === "form"} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
              {busy === "form" ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setForm(null)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-1 border-b border-neutral-200">
        {TABS.map(([k, t]) => (
          <a key={k} href={`/payroll/cash-advances?tab=${k}`} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-navy font-medium text-brand-navy" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
            {t}
          </a>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee or reference" className="mb-1 ml-auto w-56 rounded border border-neutral-300 px-2 py-1 text-xs" />
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Date given</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 text-right font-medium">Per run</th>
              <th className="px-3 py-2 text-right font-medium">Deducted</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 align-top">
            {shown.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Nothing here.</td></tr>}
            {shown.map((r) => {
              const [st, cls] = STATUS[r.status];
              const draft = r.history.filter((h) => h.status === "DRAFT");
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="text-neutral-800">{r.employee}</div>
                    <div className="text-[11px] text-neutral-500">{r.employeeCode}{r.reference && ` · ${r.reference}`}</div>
                    {r.description && <div className="text-[11px] text-neutral-500">{r.description}</div>}
                    {open === r.id && (
                      <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-600">
                        {r.history.length === 0 ? "No deductions yet." : r.history.map((h) => (
                          <div key={h.runId} className="flex justify-between gap-4">
                            <a href={`/payroll/runs/${h.runId}`} className="text-brand-blue hover:underline">{h.runNo}</a>
                            <span>{fmt(h.payDate)}{h.status === "DRAFT" ? " (draft)" : ""}</span>
                            <span className="font-mono">{peso(h.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-700">
                    {fmt(r.date)}
                    {r.startDate && <div className="text-[11px] text-neutral-500">deduct from {fmt(r.startDate)}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{peso(r.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{peso(r.installment)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                    {peso(r.deducted)}
                    {draft.length > 0 && <div className="text-[10px] text-blue-700">+{peso(draft.reduce((s, h) => s + h.amount, 0))} in draft run</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold">{peso(r.balance)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{st}</span>
                    {r.note && <div className="mt-0.5 text-[11px] text-neutral-400">{r.note}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <span className="inline-flex gap-1">
                      <button onClick={() => setOpen(open === r.id ? null : r.id)} className={`${btn} border-neutral-300 text-neutral-600 hover:bg-neutral-50`}>{open === r.id ? "Hide" : "History"}</button>
                      {canEdit && r.status !== "CANCELLED" && (
                        <button
                          onClick={() => { setForm({ id: r.id, employeeId: r.employeeId, date: r.date, amount: String(r.amount), installment: String(r.installment), startDate: r.startDate, reference: r.reference, description: r.description }); setMsg(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={`${btn} border-blue-300 text-blue-700 hover:bg-blue-50`}
                        >
                          Edit
                        </button>
                      )}
                      {canEdit && r.status === "ACTIVE" && <button onClick={() => act(r, "cancel")} disabled={busy === r.id} className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}>Cancel</button>}
                      {canEdit && r.status === "CANCELLED" && <button onClick={() => act(r, "reactivate")} disabled={busy === r.id} className={`${btn} border-green-300 text-green-700 hover:bg-green-50`}>Reactivate</button>}
                      {canEdit && r.deducted === 0 && <button onClick={() => act(r, "delete")} disabled={busy === r.id} className={`${btn} border-neutral-300 text-neutral-500 hover:bg-neutral-50`}>Delete</button>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
