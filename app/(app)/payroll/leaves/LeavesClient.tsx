"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  eligibilityProblem, leaveDatesFor, sumDays,
  type EmployeeFacts, type LeaveDate, type LeaveTypeRules,
} from "@/lib/payroll/leave";

type LeaveType = LeaveTypeRules & { id: string; isActive: boolean };
type Employee = { id: string; code: string; name: string; active: boolean; facts: EmployeeFacts };
type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type Request = {
  id: string; employeeId: string; employee: string; code: string; typeName: string; startDate: string; endDate: string;
  days: number; isPaid: boolean; reason: string; status: Status; decisionNote: string;
};
export type Balance = { employeeId: string; leaveTypeId: string; granted: number; carriedOver: number; adjustment: number; earned: number; used: number };

const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const label = "block text-xs text-neutral-500";
const STATUS_BADGE: Record<Status, string> = {
  PENDING: "bg-amber-100 text-amber-700", APPROVED: "bg-green-100 text-green-700", REJECTED: "bg-red-50 text-red-600", CANCELLED: "bg-neutral-100 text-neutral-500",
};
const mdy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
const r2 = (v: number) => Math.round(v * 100) / 100;

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const d = await res.json().catch(() => ({}));
  return d.error ?? "Something went wrong.";
}

export function LeavesClient({ canEdit, tab, year, restWeekdays, types, employees, requests, balances }: {
  canEdit: boolean; tab: "filings" | "balances"; year: number; restWeekdays: number[];
  types: LeaveType[]; employees: Employee[]; requests: Request[]; balances: Balance[];
}) {
  const router = useRouter();
  const go = (t: string, y: number) => router.push(`/payroll/leaves?tab=${t}&year=${y}`);
  const thisYear = new Date().getFullYear();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm">
          {(["filings", "balances"] as const).map((t) => (
            <button key={t} onClick={() => go(t, year)} className={`rounded-md px-3 py-1 ${tab === t ? "bg-white font-medium text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}>
              {t === "filings" ? "Leave filings" : "Balances"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          Year
          <select value={year} onChange={(e) => go(tab, Number(e.target.value))} className="rounded border border-neutral-300 px-2 py-1 text-sm">
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      {tab === "filings"
        ? <Filings canEdit={canEdit} year={year} restWeekdays={restWeekdays} types={types} employees={employees} requests={requests} balances={balances} />
        : <Balances canEdit={canEdit} year={year} types={types} employees={employees} balances={balances} />}
    </div>
  );
}

function Filings({ canEdit, year, restWeekdays, types, employees, requests, balances }: {
  canEdit: boolean; year: number; restWeekdays: number[]; types: LeaveType[]; employees: Employee[]; requests: Request[]; balances: Balance[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", leaveTypeId: "", startDate: today, endDate: today, halfDay: false, reason: "", approve: true });
  const [skip, setSkip] = useState<Set<string>>(new Set()); // dates the user unticked
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | "">("");
  const [q, setQ] = useState("");

  const type = types.find((t) => t.id === form.leaveTypeId);
  const emp = employees.find((e) => e.id === form.employeeId);
  const single = form.startDate === form.endDate;
  const dates: LeaveDate[] = useMemo(() => {
    if (!type) return [];
    return leaveDatesFor(form.startDate, form.endDate, { restWeekdays, countCalendarDays: type.countCalendarDays, halfDay: type.allowHalfDay && form.halfDay && single })
      .filter((d) => !skip.has(d.date));
  }, [type, form.startDate, form.endDate, form.halfDay, single, restWeekdays, skip]);
  const days = sumDays(dates);
  const problem = type && emp ? eligibilityProblem(type, emp.facts, form.startDate) : null;
  const bal = type && emp && type.creditBasis === "ANNUAL" ? balances.find((b) => b.employeeId === emp.id && b.leaveTypeId === type.id) : null;
  const yearOfStart = Number(form.startDate.slice(0, 4));

  function setRange(p: Partial<typeof form>) { setForm({ ...form, ...p }); setSkip(new Set()); }

  async function submit() {
    setBusy(true); setError(null);
    const err = await send("/api/payroll/leaves", "POST", { ...form, dates });
    setBusy(false);
    if (err) return setError(err);
    setOpen(false); setForm({ ...form, employeeId: "", reason: "", halfDay: false }); setSkip(new Set()); router.refresh();
  }

  async function decide(r: Request, action: "approve" | "reject" | "cancel") {
    let note: string | null = null;
    if (action !== "approve") {
      note = prompt(`${action === "reject" ? "Reject" : "Cancel"} ${r.code} leave of ${r.employee}? Note (optional):`, "");
      if (note === null) return;
    }
    const err = await send(`/api/payroll/leaves/${r.id}`, "PATCH", { action, note });
    if (err) alert(err); else router.refresh();
  }

  const rows = requests.filter((r) => (!status || r.status === status) && (!q.trim() || r.employee.toLowerCase().includes(q.trim().toLowerCase())));
  const pending = requests.filter((r) => r.status === "PENDING").length;

  return (
    <section className="mt-4 rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-800">Leave filings {year}{pending ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{pending} pending</span> : null}</h2>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | "")} className="rounded border border-neutral-300 px-2 py-1 text-sm">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_BADGE) as Status[]).map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
          {canEdit && !open && <button onClick={() => setOpen(true)} className="rounded bg-brand-navy px-3 py-1 text-sm text-white hover:bg-brand-navyLight">+ File leave</button>}
        </div>
      </div>

      {open && (
        <div className="my-3 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className={label}>Employee<select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={field}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
            </select></label>
            <label className={label}>Leave type<select value={form.leaveTypeId} onChange={(e) => setRange({ leaveTypeId: e.target.value })} className={field}>
              <option value="">Select…</option>
              {types.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}{t.isPaid ? "" : " (no pay)"}</option>)}
            </select></label>
            <label className={label}>From<input type="date" value={form.startDate} onChange={(e) => setRange({ startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })} className={field} /></label>
            <label className={label}>To<input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setRange({ endDate: e.target.value })} className={field} /></label>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className={`${label} sm:col-span-3`}>Reason<input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={field} /></label>
            <div className="space-y-1 pt-5 text-sm text-neutral-700">
              {type?.allowHalfDay && single && <label className="flex items-center gap-2"><input type="checkbox" checked={form.halfDay} onChange={(e) => setForm({ ...form, halfDay: e.target.checked })} /> Half day</label>}
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.approve} onChange={(e) => setForm({ ...form, approve: e.target.checked })} /> Approve now</label>
            </div>
          </div>

          {type && (
            <div className="mt-3 rounded border border-neutral-200 bg-white p-2 text-xs text-neutral-600">
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span><b>{days}</b> {type.countCalendarDays ? "calendar" : "working"} day(s){type.isPaid ? " with pay" : " without pay"}</span>
                {type.creditBasis === "PER_EVENT" && <span>Up to {type.days} days per filing</span>}
                {type.creditBasis === "ANNUAL" && emp && (
                  bal && yearOfStart === year
                    ? <span>Balance {year}: <b>{r2(bal.earned - bal.used)}</b> of {r2(bal.earned)} available</span>
                    : yearOfStart === year ? <span className="text-amber-700">No {type.code} credits for {year} yet. Grant them under Balances.</span> : null
                )}
              </div>
              {problem && <p className="mt-1 text-red-600">{problem}</p>}
              {!type.countCalendarDays && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {leaveDatesFor(form.startDate, form.endDate, { restWeekdays, countCalendarDays: false }).slice(0, 62).map((d) => (
                    <label key={d.date} className={`flex items-center gap-1 rounded border px-1.5 py-0.5 ${skip.has(d.date) ? "border-neutral-200 text-neutral-400" : "border-brand-blue/40 text-neutral-700"}`} title="Untick a date that isn't a leave day (e.g. a holiday)">
                      <input type="checkbox" checked={!skip.has(d.date)} onChange={(e) => { const s = new Set(skip); if (e.target.checked) s.delete(d.date); else s.add(d.date); setSkip(s); }} />
                      {mdy(d.date).slice(0, 5)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button onClick={submit} disabled={busy || !type || !emp || days <= 0 || !!problem} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">{form.approve ? "File & approve" : "File leave"}</button>
            <button onClick={() => { setOpen(false); setError(null); }} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-3">Employee</th><th className="py-2 pr-3">Leave</th><th className="py-2 pr-3">Dates</th>
              <th className="py-2 pr-3 text-right">Days</th><th className="py-2 pr-3">Reason</th><th className="py-2 pr-3">Status</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 && <tr><td colSpan={7} className="py-3 text-neutral-400">No leave filings.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="py-1.5 pr-3">{r.employee}</td>
                <td className="py-1.5 pr-3"><span className="font-mono text-xs">{r.code}</span> <span className="text-xs text-neutral-500">{r.typeName}{r.isPaid ? "" : " (no pay)"}</span></td>
                <td className="py-1.5 pr-3 text-xs">{r.startDate === r.endDate ? mdy(r.startDate) : `${mdy(r.startDate)} – ${mdy(r.endDate)}`}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{r.days}</td>
                <td className="py-1.5 pr-3 text-xs text-neutral-600">{r.reason}{r.decisionNote && <div className="text-neutral-400">Note: {r.decisionNote}</div>}</td>
                <td className="py-1.5 pr-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                <td className="whitespace-nowrap py-1.5 text-right">
                  {canEdit && r.status === "PENDING" && <>
                    <button onClick={() => decide(r, "approve")} className="rounded px-2 py-0.5 text-xs text-green-700 hover:bg-green-50">Approve</button>
                    <button onClick={() => decide(r, "reject")} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Reject</button>
                  </>}
                  {canEdit && (r.status === "PENDING" || r.status === "APPROVED") && <button onClick={() => decide(r, "cancel")} className="rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100">Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Balances({ canEdit, year, types, employees, balances }: { canEdit: boolean; year: number; types: LeaveType[]; employees: Employee[]; balances: Balance[] }) {
  const router = useRouter();
  const annual = types.filter((t) => t.creditBasis === "ANNUAL" && t.isActive);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ employeeId: string; leaveTypeId: string; granted: string; carriedOver: string; adjustment: string } | null>(null);

  async function grant() {
    if (!confirm(`Grant ${year} leave credits to every eligible employee? Employees who already have ${year} credits keep them.`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/payroll/leave-credits/grant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `Granted ${d.created} credit record(s).` : d.error ?? "Could not grant credits.");
    if (res.ok) router.refresh();
  }

  async function saveEdit() {
    if (!edit) return;
    const err = await send("/api/payroll/leave-credits", "PUT", { ...edit, year });
    if (err) return alert(err);
    setEdit(null); router.refresh();
  }

  const find = (e: string, t: string) => balances.find((b) => b.employeeId === e && b.leaveTypeId === t);

  return (
    <section className="mt-4 rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-neutral-800">Leave balances {year}</h2>
          <p className="text-xs text-neutral-500">Available / earned for leave types with yearly credits. Pending filings are already deducted. Click a cell to adjust.</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-neutral-600">{msg}</span>}
          {canEdit && <button onClick={grant} disabled={busy} className="rounded bg-brand-navy px-3 py-1 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">Grant {year} credits</button>}
        </div>
      </div>

      {edit && (
        <div className="my-3 flex flex-wrap items-end gap-3 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3 text-sm">
          <span className="pb-1.5 font-medium">{employees.find((e) => e.id === edit.employeeId)?.name} · {types.find((t) => t.id === edit.leaveTypeId)?.code}</span>
          {(["granted", "carriedOver", "adjustment"] as const).map((k) => (
            <label key={k} className={label}>{k === "granted" ? "Granted" : k === "carriedOver" ? "Carried over" : "Adjustment (±)"}
              <input value={edit[k]} inputMode="decimal" onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className={`${field} w-24 text-right font-mono`} />
            </label>
          ))}
          <button onClick={saveEdit} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight">Save</button>
          <button onClick={() => setEdit(null)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
        </div>
      )}

      {annual.length === 0 ? <p className="mt-3 text-sm text-neutral-500">No active leave types with yearly credits.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-3">Employee</th>
                {annual.map((t) => <th key={t.id} className="py-2 pr-3 text-right" title={t.name}>{t.code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {employees.length === 0 && <tr><td colSpan={annual.length + 1} className="py-3 text-neutral-400">No employees with pay details.</td></tr>}
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 pr-3">{e.name}</td>
                  {annual.map((t) => {
                    const b = find(e.id, t.id);
                    const cell = b ? <><b className={b.earned - b.used < 0 ? "text-red-600" : ""}>{r2(b.earned - b.used)}</b><span className="text-neutral-400"> / {r2(b.earned)}</span></> : <span className="text-neutral-300">—</span>;
                    return (
                      <td key={t.id} className="py-1.5 pr-3 text-right font-mono text-xs">
                        {canEdit
                          ? <button onClick={() => setEdit({ employeeId: e.id, leaveTypeId: t.id, granted: String(b?.granted ?? t.days), carriedOver: String(b?.carriedOver ?? 0), adjustment: String(b?.adjustment ?? 0) })} className="rounded px-1 hover:bg-blue-50">{cell}</button>
                          : cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
