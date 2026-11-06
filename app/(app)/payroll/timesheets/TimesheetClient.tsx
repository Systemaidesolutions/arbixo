"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Shift } from "@/lib/payroll/biometric";
import type { PayFrequency } from "@/lib/payroll/compute";
import { figuresFromTimes, normalizeTime, totalsOf, type TimesheetRow } from "@/lib/payroll/timesheet";

type Emp = {
  id: string; code: string; name: string; position: string | null; payBasis: "MONTHLY" | "DAILY";
  groupId: string | null; locationId: string | null; shiftStart: string | null; shiftEnd: string | null; restWeekdays: number[];
};
type Group = { id: string; name: string; frequency: PayFrequency; weekStartDay: number };
type Entry = TimesheetRow & { employeeId: string };
type Leave = { date: string; days: number; paid: boolean; code: string };

/** What the inputs hold (text, so typing is smooth). status "" = not encoded. */
type Draft = { status: "" | "PRESENT" | "ABSENT"; timeIn: string; timeOut: string; days: string; late: string; ot: string; nd: string; ndOt: string; remarks: string };
const EMPTY: Draft = { status: "", timeIn: "", timeOut: "", days: "", late: "", ot: "", nd: "", ndOt: "", remarks: "" };
type Mode = "day" | "employee" | "summary";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const mdy = (d: string) => { const [y, m, dd] = d.split("-"); return `${m}/${dd}/${y}`; };
const datesBetween = (from: string, to: string) => { const out: string[] = []; for (let d = from, i = 0; d <= to && i < 62; d = addDays(d, 1), i++) out.push(d); return out; };
const weekOf = (d: string, startDay: number) => { const from = addDays(d, -((dow(d) - startDay + 7) % 7)); return { from, to: addDays(from, 6) }; };
const monthEnd = (d: string) => { const [y, m] = d.split("-").map(Number); return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`; };

const s = (n: number) => (n ? String(n) : "");
const toDraft = (e?: Entry): Draft => e
  ? { status: e.status, timeIn: e.timeIn ?? "", timeOut: e.timeOut ?? "", days: e.status === "PRESENT" ? String(e.days) : "", late: s(e.lateMinutes), ot: s(e.otHours), nd: s(e.ndHours), ndOt: s(e.ndOtHours), remarks: e.remarks ?? "" }
  : EMPTY;
const sameDraft = (a: Draft, b: Draft) => (Object.keys(a) as (keyof Draft)[]).every((k) => a[k] === b[k]);

const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
const cell = "rounded border border-neutral-300 px-1 py-0.5 text-right font-mono text-xs disabled:border-transparent disabled:bg-transparent";
const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40";
const btnPrimary = "rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50";

export function TimesheetClient({ canEdit, employees, groups, branches, shift }: {
  canEdit: boolean; employees: Emp[]; groups: Group[]; branches: { id: string; name: string }[]; shift: Shift;
}) {
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(todayIso);
  const [range, setRange] = useState(() => weekOf(todayIso(), 1));
  const [groupId, setGroupId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [saved, setSaved] = useState<Record<string, Entry>>({});
  const [leaves, setLeaves] = useState<Record<string, Leave[]>>({});
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);

  const group = groups.find((g) => g.id === groupId);
  const weekStart = group?.frequency === "WEEKLY" ? group.weekStartDay : 1;
  const emps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) =>
      (!groupId || e.groupId === groupId) && (!branchId || e.locationId === branchId) &&
      (!q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)));
  }, [employees, groupId, branchId, search]);
  const emp = emps.find((e) => e.id === employeeId) ?? emps[0] ?? null;

  const span = mode === "day" ? { from: date, to: date } : range;
  const loadEmployee = mode === "employee" ? emp?.id ?? "" : "";

  useEffect(() => {
    if (mode === "employee" && !loadEmployee) return;
    let off = false;
    setLoading(true);
    const qs = new URLSearchParams({ from: span.from, to: span.to });
    if (loadEmployee) qs.set("employeeId", loadEmployee);
    fetch(`/api/payroll/timesheets?${qs}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (off) return;
        if (!ok) { setMsg({ ok: false, text: d.error ?? "Could not load the timesheet." }); return; }
        setSaved(Object.fromEntries((d.entries as Entry[]).map((e) => [`${e.employeeId}|${e.date}`, e])));
        setLeaves(d.leaves ?? {});
        setEdits({});
      })
      .catch(() => { if (!off) setMsg({ ok: false, text: "Could not load the timesheet." }); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [mode, span.from, span.to, loadEmployee, reload]);

  const dirty = Object.keys(edits).length;
  /** Runs a navigation only after unsaved changes are saved or knowingly dropped. */
  const guard = (fn: () => void) => { if (dirty && !confirm("You have unsaved changes. Leave without saving?")) return; setMsg(null); fn(); };

  const draftOf = (key: string): Draft => edits[key] ?? toDraft(saved[key]);
  const shiftFor = (e: Emp): Shift => ({ ...shift, start: e.shiftStart ?? shift.start, end: e.shiftEnd ?? shift.end });

  function setDraft(key: string, d: Draft) {
    setEdits((cur) => {
      const next = { ...cur };
      if (sameDraft(d, toDraft(saved[key]))) delete next[key]; else next[key] = d;
      return next;
    });
  }
  function update(e: Emp, day: string, change: Partial<Draft>) {
    const key = `${e.id}|${day}`;
    let d = { ...draftOf(key), ...change };
    if (change.status === "ABSENT") d = { ...EMPTY, status: "ABSENT", remarks: d.remarks };
    if (change.status === "PRESENT" && !d.days) d.days = "1";
    if (change.status === "") d = EMPTY;
    setDraft(key, d);
  }
  /** On leaving a time box: tidy "730" to 07:30 and work out the day from the times. */
  function timesDone(e: Emp, day: string) {
    const key = `${e.id}|${day}`;
    const cur = draftOf(key);
    const tin = cur.timeIn ? normalizeTime(cur.timeIn) : "";
    const tout = cur.timeOut ? normalizeTime(cur.timeOut) : "";
    let d: Draft = { ...cur, timeIn: tin ?? cur.timeIn, timeOut: tout ?? cur.timeOut };
    const f = tin && tout ? figuresFromTimes(day, tin, tout, shiftFor(e)) : null;
    if (f) d = { ...d, status: "PRESENT", days: String(f.days), late: s(f.lateMinutes), ot: s(f.otHours), nd: s(f.ndHours), ndOt: s(f.ndOtHours) };
    else if ((tin || tout) && !d.status) d = { ...d, status: "PRESENT", days: d.days || "1" };
    setDraft(key, d);
  }

  const onLeaveFull = (e: Emp, day: string) => (leaves[e.id] ?? []).some((l) => l.date === day && l.days >= 1);
  /** Marks the not-yet-encoded workdays as a present full day (rest days and approved leave are skipped). */
  function markPresent(pairs: [Emp, string][]) {
    setEdits((cur) => {
      const next = { ...cur };
      for (const [e, day] of pairs) {
        const key = `${e.id}|${day}`;
        if (next[key]?.status || saved[key] || e.restWeekdays.includes(dow(day)) || onLeaveFull(e, day)) continue;
        next[key] = { ...EMPTY, status: "PRESENT", days: "1" };
      }
      return next;
    });
    setMsg({ ok: true, text: "Marked the not-yet-encoded workdays as present for a full day. Change any exception, then Save." });
  }

  async function save(after?: () => void) {
    const entries: Record<string, unknown>[] = [];
    for (const [key, d] of Object.entries(edits)) {
      const [employeeId, day] = key.split("|");
      const who = employees.find((x) => x.id === employeeId)?.name ?? "";
      if (d.status === "") { entries.push({ employeeId, date: day, status: "NONE" }); continue; }
      if ((d.timeIn && !normalizeTime(d.timeIn)) || (d.timeOut && !normalizeTime(d.timeOut))) {
        return setMsg({ ok: false, text: `Check the time for ${who} on ${mdy(day)}. Use a time like 08:00, 730, or 5:30 PM.` });
      }
      entries.push({
        employeeId, date: day, status: d.status, timeIn: normalizeTime(d.timeIn), timeOut: normalizeTime(d.timeOut), days: Number(d.days) || 0,
        lateMinutes: Number(d.late) || 0, otHours: Number(d.ot) || 0, ndHours: Number(d.nd) || 0, ndOtHours: Number(d.ndOt) || 0, remarks: d.remarks || null,
      });
    }
    if (!entries.length) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/payroll/timesheets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? "Could not save." });
    setMsg({ ok: true, text: `Saved ${d.saved ?? 0} day(s)${d.cleared ? `, cleared ${d.cleared}` : ""}.` });
    setEdits({});
    if (after) after(); else setReload((n) => n + 1);
  }

  // ---------------- Pieces ----------------

  function entryRow(e: Emp, day: string, lead: React.ReactNode) {
    const key = `${e.id}|${day}`;
    const d = draftOf(key);
    const absent = d.status === "ABSENT";
    const lv = (leaves[e.id] ?? []).filter((l) => l.date === day);
    const rest = e.restWeekdays.includes(dow(day));
    const off = !canEdit;
    const num = (k: keyof Draft, title?: string) => (
      <td className="px-1 py-1"><input value={d[k]} disabled={off || absent || d.status === ""} inputMode="decimal" title={title}
        onChange={(ev) => update(e, day, { [k]: ev.target.value } as Partial<Draft>)} className={`${cell} w-14`} /></td>
    );
    const time = (k: "timeIn" | "timeOut", ph: string) => (
      <td className="px-1 py-1"><input value={d[k]} disabled={off || absent} placeholder={ph}
        onChange={(ev) => update(e, day, { [k]: ev.target.value } as Partial<Draft>)}
        onBlur={() => timesDone(e, day)} className={`${cell} w-16 text-center`} /></td>
    );
    return (
      <tr key={key} className={key in edits ? "bg-amber-50" : absent ? "bg-red-50/60" : d.status === "PRESENT" ? "" : rest ? "bg-neutral-50" : ""}>
        {lead}
        <td className="px-1 py-1">
          <select value={d.status} disabled={off} onChange={(ev) => update(e, day, { status: ev.target.value as Draft["status"] })}
            className={`rounded border px-1 py-0.5 text-xs ${d.status === "PRESENT" ? "border-green-300 bg-green-50 text-green-800" : absent ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-300"}`}>
            <option value="">Not encoded</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
          </select>
          {rest && <span className="ml-1 rounded bg-neutral-200 px-1 text-[10px] text-neutral-600" title="This employee's rest day">Rest</span>}
          {lv.map((l) => <span key={l.code + l.days} className="ml-1 rounded bg-blue-100 px-1 text-[10px] text-blue-700" title={`Approved leave (${l.paid ? "with pay" : "without pay"})`}>{l.code}{l.days < 1 ? " ½" : ""}</span>)}
        </td>
        {time("timeIn", "08:00")}
        {time("timeOut", "17:00")}
        <td className="px-1 py-1">
          <select value={d.days} disabled={off || absent || d.status === ""} onChange={(ev) => update(e, day, { days: ev.target.value })} className="rounded border border-neutral-300 px-1 py-0.5 text-xs disabled:border-transparent disabled:bg-transparent disabled:appearance-none">
            {d.status === "" || absent ? <option value="">–</option> : null}
            <option value="1">1</option>
            <option value="0.5">0.5</option>
          </select>
        </td>
        {num("late", "Late + undertime, in minutes")}
        {num("ot", "Overtime hours on this day")}
        {num("nd", "Night hours (10pm–6am) within the shift")}
        {num("ndOt", "Overtime hours that fall at night")}
        <td className="px-1 py-1"><input value={d.remarks} disabled={off || d.status === ""} onChange={(ev) => update(e, day, { remarks: ev.target.value })} maxLength={200} className="w-44 rounded border border-neutral-300 px-1 py-0.5 text-xs disabled:border-transparent disabled:bg-transparent" placeholder={d.status ? "Remarks" : ""} /></td>
      </tr>
    );
  }

  const head = (lead: React.ReactNode) => (
    <thead>
      <tr className="border-b border-neutral-200 text-left text-[11px] uppercase tracking-wide text-neutral-500">
        {lead}
        <th className="px-1 py-2 font-medium">Status</th>
        <th className="px-1 py-2 text-center font-medium">Time in</th>
        <th className="px-1 py-2 text-center font-medium">Time out</th>
        <th className="px-1 py-2 font-medium">Day</th>
        <th className="px-1 py-2 text-right font-medium" title="Late + undertime, in minutes">Late (min)</th>
        <th className="px-1 py-2 text-right font-medium" title="Overtime hours">OT (hrs)</th>
        <th className="px-1 py-2 text-right font-medium" title="Night hours 10pm–6am, within the shift">Night (hrs)</th>
        <th className="px-1 py-2 text-right font-medium" title="Overtime hours that fall at night">Night OT</th>
        <th className="px-1 py-2 font-medium">Remarks</th>
      </tr>
    </thead>
  );

  const picker = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-neutral-500">Pay group
        <select value={groupId} onChange={(e) => guard(() => setGroupId(e.target.value))} className={`${field} mt-1 block`}>
          <option value="">All</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      {branches.length > 0 && (
        <label className="text-xs text-neutral-500">Branch
          <select value={branchId} onChange={(e) => guard(() => setBranchId(e.target.value))} className={`${field} mt-1 block`}>
            <option value="">All</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-xs text-neutral-500">Find employee
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code" className={`${field} mt-1 block w-44`} />
      </label>
    </div>
  );

  const periodPicker = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-neutral-500">From<input type="date" value={range.from} onChange={(e) => e.target.value && guard(() => setRange({ from: e.target.value, to: e.target.value > range.to ? e.target.value : range.to }))} className={`${field} mt-1 block`} /></label>
      <label className="text-xs text-neutral-500">To<input type="date" value={range.to} onChange={(e) => e.target.value && guard(() => setRange({ from: e.target.value < range.from ? e.target.value : range.from, to: e.target.value }))} className={`${field} mt-1 block`} /></label>
      <div className="flex flex-wrap gap-1.5 pb-0.5">
        <button className={btn} onClick={() => guard(() => setRange(weekOf(todayIso(), weekStart)))}>This week</button>
        <button className={btn} onClick={() => guard(() => setRange(weekOf(addDays(todayIso(), -7), weekStart)))}>Last week</button>
        <button className={btn} onClick={() => guard(() => { const m = todayIso().slice(0, 8); setRange({ from: `${m}01`, to: `${m}15` }); })}>1st–15th</button>
        <button className={btn} onClick={() => guard(() => { const t = todayIso(); setRange({ from: `${t.slice(0, 8)}16`, to: monthEnd(t) }); })}>16th–end</button>
        <button className={btn} title="Previous period" onClick={() => guard(() => { const n = datesBetween(range.from, range.to).length; setRange({ from: addDays(range.from, -n), to: addDays(range.from, -1) }); })}>◀</button>
        <button className={btn} title="Next period" onClick={() => guard(() => { const n = datesBetween(range.from, range.to).length; setRange({ from: addDays(range.to, 1), to: addDays(range.to, n) }); })}>▶</button>
      </div>
    </div>
  );

  const dates = datesBetween(span.from, span.to);
  const empIndex = emp ? emps.findIndex((x) => x.id === emp.id) : -1;
  const nextEmp = empIndex >= 0 ? emps[empIndex + 1] : undefined;
  const tabClass = (m: Mode) => `rounded-t px-4 py-2 text-sm ${mode === m ? "border border-b-white border-neutral-200 bg-white font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-800"}`;

  return (
    <div>
      <div className="flex gap-1 border-b border-neutral-200">
        <button className={tabClass("day")} onClick={() => guard(() => setMode("day"))}>Daily sheet</button>
        <button className={tabClass("employee")} onClick={() => guard(() => setMode("employee"))}>By employee</button>
        <button className={tabClass("summary")} onClick={() => guard(() => setMode("summary"))}>Summary</button>
      </div>

      <section className="rounded-b-lg border border-t-0 border-neutral-200 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            {mode === "day" ? (
              <div className="flex items-end gap-1.5">
                <label className="text-xs text-neutral-500">Date<input type="date" value={date} onChange={(e) => e.target.value && guard(() => setDate(e.target.value))} className={`${field} mt-1 block`} /></label>
                <button className={btn} title="Previous day" onClick={() => guard(() => setDate(addDays(date, -1)))}>◀</button>
                <button className={btn} title="Next day" onClick={() => guard(() => setDate(addDays(date, 1)))}>▶</button>
                <button className={btn} onClick={() => guard(() => setDate(todayIso()))}>Today</button>
              </div>
            ) : periodPicker}
            {picker}
            {mode === "employee" && (
              <label className="text-xs text-neutral-500">Employee
                <select value={emp?.id ?? ""} onChange={(e) => guard(() => setEmployeeId(e.target.value))} className={`${field} mt-1 block min-w-[14rem]`}>
                  {emps.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.code})</option>)}
                </select>
              </label>
            )}
          </div>
          {canEdit && mode !== "summary" && (
            <div className="flex flex-wrap items-center gap-2">
              <button className={btn} onClick={() => markPresent(mode === "day" ? emps.map((e) => [e, date] as [Emp, string]) : emp ? dates.map((d) => [emp, d] as [Emp, string]) : [])}
                title="Marks every workday not yet encoded as a present full day; rest days and approved leave are skipped. Fix the exceptions after.">Mark the rest present</button>
              <button className={btn} disabled={busy || !dirty} onClick={() => save()}>Save{dirty ? ` (${dirty})` : ""}</button>
              {mode === "employee" && nextEmp && <button className={btnPrimary} disabled={busy} onClick={() => save(() => { setEmployeeId(nextEmp.id); })}>Save & next employee</button>}
            </div>
          )}
        </div>

        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
        {dirty > 0 && <p className="mt-2 text-xs text-amber-700">{dirty} unsaved change(s), highlighted below.</p>}
        {!canEdit && <p className="mt-2 text-xs text-neutral-500">Your account can view timesheets but not encode them.</p>}
        {employees.length === 0 && <p className="mt-4 text-sm text-neutral-500">No payroll employees yet. Add them under <Link href="/payroll/employees" className="text-brand-blue hover:underline">Payroll employees</Link> first.</p>}

        {/* Daily sheet: every employee for one date */}
        {mode === "day" && emps.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs text-neutral-500">
              {WEEKDAY[dow(date)]} {mdy(date)} · type the time in and out (08:00, 730, 5:30 PM) and the day, late, overtime and night hours are worked out from the shift
              ({shift.start}–{shift.end}); adjust them if needed. Choose <b>Absent</b> for no-shows. {loading && <span className="text-neutral-400">Loading…</span>}
            </p>
            <table className="w-full min-w-[60rem] text-sm">
              {head(<th className="px-1 py-2 font-medium">Employee</th>)}
              <tbody className="divide-y divide-neutral-100">
                {emps.map((e) => entryRow(e, date, (
                  <td className="px-1 py-1">
                    <div className="text-neutral-800">{e.name}</div>
                    <div className="text-[11px] text-neutral-400">{e.code}{e.position ? ` · ${e.position}` : ""} · {e.payBasis === "DAILY" ? "daily" : "monthly"}</div>
                  </td>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {/* One employee over a period */}
        {mode === "employee" && emp && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs text-neutral-500">
              {emp.name} · {emp.payBasis === "DAILY" ? "daily rate" : "monthly salary"} · shift {emp.shiftStart ?? shift.start}–{emp.shiftEnd ?? shift.end} · rest day{emp.restWeekdays.length === 1 ? "" : "s"}: {emp.restWeekdays.length ? emp.restWeekdays.map((w) => WEEKDAY[w]).join(", ") : "varies"} {loading && <span className="text-neutral-400">Loading…</span>}
            </p>
            <table className="w-full min-w-[60rem] text-sm">
              {head(<th className="px-1 py-2 font-medium">Date</th>)}
              <tbody className="divide-y divide-neutral-100">
                {dates.map((d) => entryRow(emp, d, (
                  <td className="px-1 py-1 text-neutral-800">{WEEKDAY[dow(d)]} <span className="font-mono text-xs">{mdy(d).slice(0, 5)}</span></td>
                )))}
              </tbody>
            </table>
            <PeriodTotals rows={dates.map((d) => draftToRow(d, draftOf(`${emp.id}|${d}`))).filter((r): r is TimesheetRow => !!r)} />
          </div>
        )}
        {mode === "employee" && !emp && employees.length > 0 && <p className="mt-4 text-sm text-neutral-500">No employee matches the filter.</p>}

        {/* Summary matrix */}
        {mode === "summary" && emps.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs text-neutral-500">
              <b>1</b> full day · <b>½</b> half day · <b className="text-red-600">A</b> absent · <b className="text-blue-600">L</b> approved leave · <span className="text-neutral-400">· rest day</span> · <b className="text-amber-600">?</b> workday not encoded.
              Click a name to open that employee&apos;s sheet. Create the payroll run in <Link href="/payroll/runs" className="text-brand-blue hover:underline">Payroll runs</Link> once the period is complete. {loading && <span className="text-neutral-400">Loading…</span>}
            </p>
            <table className="text-xs">
              <thead>
                <tr className="text-neutral-500">
                  <th className="sticky left-0 z-10 min-w-[14rem] bg-white py-1 pr-3 text-left font-medium">Employee</th>
                  {dates.map((d) => <th key={d} className={`px-0.5 py-1 text-center font-normal ${dow(d) === 0 ? "text-rose-500" : ""}`}><div>{WEEKDAY[dow(d)]}</div><div className="font-medium text-neutral-700">{d.slice(8)}</div></th>)}
                  <th className="px-2 text-right font-medium">Days</th><th className="px-2 text-right font-medium">Absent</th>
                  <th className="px-2 text-right font-medium">Late (min)</th><th className="px-2 text-right font-medium">OT (hrs)</th><th className="px-2 text-right font-medium">Night (hrs)</th>
                  <th className="px-2 text-right font-medium" title="Workdays (not rest days or approved leave) with nothing encoded">Not encoded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {emps.map((e) => {
                  const rows = dates.map((d) => saved[`${e.id}|${d}`]).filter(Boolean);
                  const t = totalsOf(rows);
                  const lv = new Set((leaves[e.id] ?? []).filter((l) => l.days >= 1).map((l) => l.date));
                  const missing = dates.filter((d) => !saved[`${e.id}|${d}`] && !e.restWeekdays.includes(dow(d)) && !lv.has(d)).length;
                  return (
                    <tr key={e.id} className="hover:bg-neutral-50">
                      <td className="sticky left-0 z-10 bg-white py-1 pr-3">
                        <button className="text-left text-brand-blue hover:underline" onClick={() => guard(() => { setEmployeeId(e.id); setMode("employee"); })}>{e.name}</button>
                        <div className="text-[10px] text-neutral-400">{e.code} · {e.payBasis === "DAILY" ? "daily" : "monthly"}</div>
                      </td>
                      {dates.map((d) => {
                        const en = saved[`${e.id}|${d}`];
                        const onLv = (leaves[e.id] ?? []).some((l) => l.date === d);
                        const rest = e.restWeekdays.includes(dow(d));
                        let text = "", cls = "text-neutral-300", title = "";
                        if (en?.status === "PRESENT") { text = en.days === 1 ? "1" : en.days === 0.5 ? "½" : String(en.days); cls = "font-medium text-green-700"; title = `${en.timeIn ?? ""}${en.timeOut ? `–${en.timeOut}` : ""}${en.lateMinutes ? ` · late ${en.lateMinutes}m` : ""}${en.otHours ? ` · OT ${en.otHours}h` : ""}`.trim(); }
                        else if (en?.status === "ABSENT") { text = "A"; cls = "font-medium text-red-600"; }
                        else if (onLv) { text = "L"; cls = "font-medium text-blue-600"; title = "Approved leave"; }
                        else if (rest) { text = "·"; }
                        else { text = "?"; cls = "text-amber-500"; title = "Not encoded"; }
                        return <td key={d} title={title || undefined} className={`h-6 w-7 px-0.5 text-center ${cls} ${rest && !en ? "bg-neutral-50" : ""}`}>{text}</td>;
                      })}
                      <td className="px-2 text-right font-mono">{t.days || "–"}</td>
                      <td className="px-2 text-right font-mono">{t.absent || "–"}</td>
                      <td className="px-2 text-right font-mono">{t.lateMinutes || "–"}</td>
                      <td className="px-2 text-right font-mono">{t.otHours || "–"}</td>
                      <td className="px-2 text-right font-mono">{t.ndHours || "–"}</td>
                      <td className={`px-2 text-right font-mono ${missing ? "font-medium text-amber-600" : "text-neutral-400"}`}>{missing || "✓"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {emps.length === 0 && employees.length > 0 && mode !== "employee" && <p className="mt-4 text-sm text-neutral-500">No employee matches the filter.</p>}
      </section>
    </div>
  );
}

/** A draft as a timesheet row, for the period totals (skips days not encoded). */
function draftToRow(date: string, d: Draft): TimesheetRow | null {
  if (!d.status) return null;
  return {
    date, status: d.status, timeIn: d.timeIn || null, timeOut: d.timeOut || null, remarks: d.remarks || null,
    days: Number(d.days) || 0, lateMinutes: Number(d.late) || 0, otHours: Number(d.ot) || 0, ndHours: Number(d.nd) || 0, ndOtHours: Number(d.ndOt) || 0,
  };
}

function PeriodTotals({ rows }: { rows: TimesheetRow[] }) {
  const t = totalsOf(rows);
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
      <span>Days worked <b className="font-mono text-neutral-900">{t.days}</b></span>
      <span>Absent <b className="font-mono text-neutral-900">{t.absent}</b></span>
      <span>Late <b className="font-mono text-neutral-900">{t.lateMinutes}</b> min</span>
      <span>Overtime <b className="font-mono text-neutral-900">{t.otHours}</b> hrs</span>
      <span>Night <b className="font-mono text-neutral-900">{t.ndHours}</b> hrs</span>
    </div>
  );
}
