"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";
import {
  computeLine, DAY_TYPE_LABEL, dayMultiplier, employeeDayTypes, holidayPart, periodDates,
  type Adjustment, type DayHours, type DayType, type GroupRules, type LineResult, type PayrollRules,
} from "@/lib/payroll/compute";
import type { RunLeave } from "@/lib/payroll/leave";
import type { LinePatch, Shift } from "@/lib/payroll/biometric";
import { BiometricImport } from "./BiometricImport";

type PayItem = { id: string; code: string; name: string; kind: "EARNING" | "DEDUCTION"; taxable: boolean; isOtherBenefit: boolean; isActive: boolean };
type Line = {
  employeeId: string; code: string; name: string; position: string | null; payBasis: "MONTHLY" | "DAILY"; rate: number; isMinimumWage: boolean;
  attendance: Record<string, number>; absentDays: number; lateMinutes: number; otHours: number; nightDiffHours: number;
  absentHours?: number; lateHours?: number; // what the editor shows; saved as days / minutes
  adjustments: { payItemId: string; amount: number }[];
  leaves: RunLeave[]; // approved leave in the period (read-only here; managed under Payroll › Leave)
  dayHours: Record<string, DayHours>; // work/OT/night hours on specific dates
  leaveConversionDays: number; // unused leave converted to cash, paid this run
  reimbursements: number; // approved reimbursements paid with this run (net pay only, not taxed)
  benefitsExemptRemaining: number; // left of the yearly 13th-month/bonus exemption
  biometricId: string | null; shiftStart: string | null; shiftEnd: string | null; // for the biometric import
  restDayMode: "FIXED" | "FLEXIBLE"; // FLEXIBLE = no fixed rest day, marked here every run
  restDates: string[]; // this employee's rest days in the period
  scheduledRest: string[]; // what the fixed schedule gives (for "reset")
};
type Run = {
  id: string; runNo: string; status: "DRAFT" | "POSTED" | "CANCELLED"; groupName: string; branch: string | null;
  periodStart: string; periodEnd: string; payDate: string; remarks: string; dayTypes: Record<string, DayType>;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_TYPE_STYLE: Record<DayType, string> = {
  REG: "", RD: "bg-neutral-100", SH: "bg-amber-50", SHRD: "bg-amber-100", DSH: "bg-amber-100", DSHRD: "bg-amber-200",
  RH: "bg-rose-50", RHRD: "bg-rose-100", DH: "bg-rose-100", DHRD: "bg-rose-200",
};
// The run marks holidays only; rest days come from each employee.
const HOLIDAY_TYPES: DayType[] = ["REG", "SH", "DSH", "RH", "DH"];
const DAY_TYPE_SHORT: Record<DayType, string> = {
  REG: "Ord", RD: "Rest", SH: "SH", SHRD: "SH+R", DSH: "2SH", DSHRD: "2SH+R", RH: "RH", RHRD: "RH+R", DH: "2RH", DHRD: "2RH+R",
};
const mdy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const cellInput = "w-14 rounded border border-neutral-300 px-1 py-0.5 text-right font-mono text-xs disabled:border-transparent disabled:bg-transparent";
const STATUS_BADGE = { DRAFT: "bg-amber-100 text-amber-700", POSTED: "bg-green-100 text-green-700", CANCELLED: "bg-neutral-100 text-neutral-500" };

export function RunEditor({ companyId, run, rules, group, items, lines: initialLines, available, canEdit, canCancel, shift }: {
  companyId: string; run: Run; rules: PayrollRules; group: GroupRules; items: PayItem[]; lines: Line[]; shift: Shift;
  available: { employeeId: string; label: string }[]; canEdit: boolean; canCancel: boolean;
}) {
  const router = useRouter();
  // Every register input is in hours. Absences are stored in days and late in
  // minutes, so convert on the way in and out.
  const hpd = Number(rules.hoursPerDay) || 8;
  const h2 = (v: number) => Math.round(v * 100) / 100;
  const absentDaysOf = (l: Line) => (Number(l.absentHours) || 0) / hpd;
  const lateMinutesOf = (l: Line) => (Number(l.lateHours) || 0) * 60;
  const [lines, setLines] = useState<Line[]>(() => initialLines.map((l) => ({ ...l, absentHours: h2(l.absentDays * hpd), lateHours: h2(l.lateMinutes / 60) })));
  const [dayTypes, setDayTypes] = useState<Record<string, DayType>>(run.dayTypes);
  const [remarks, setRemarks] = useState(run.remarks);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addId, setAddId] = useState("");
  const [importing, setImporting] = useState(false);
  // What the last "Fill from timesheets" found: who has no entries, and workdays still not encoded.
  const [fillInfo, setFillInfo] = useState<{ filled: number; noEntries: string[]; missing: { name: string; count: number }[]; absent: { name: string; count: number }[] } | null>(null);

  /** Merges imported attendance into the lines; the user reviews and saves. */
  function applyImport(patches: Map<string, LinePatch>) {
    setLines((ls) => ls.map((l) => {
      const p = patches.get(l.employeeId);
      return p ? { ...l, ...p, absentHours: l.payBasis === "MONTHLY" ? h2(p.absentDays * hpd) : l.absentHours, lateHours: h2(p.lateMinutes / 60) } : l;
    }));
    setDirty(true);
    setImporting(false);
    setMsg({ ok: true, text: `Imported biometric attendance for ${patches.size} employee(s). Review the figures, then Save.` });
  }

  /** Pulls the period's timesheet entries into the lines; the user reviews and saves, like the biometric import. */
  async function fillFromTimesheets() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/payroll/runs/${run.id}/timesheet`);
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? "Could not read the timesheets." });
    type Fill = { employeeId: string; attendance: Record<string, number>; absentDays: number; lateMinutes: number; otHours: number; nightDiffHours: number; dayHours: Record<string, DayHours>; missingDates: string[]; absentDates: string[] };
    const fills = new Map<string, Fill>((d.fills as Fill[]).map((x) => [x.employeeId, x]));
    const nameOf = (id: string) => lines.find((l) => l.employeeId === id)?.name ?? id;
    setLines((ls) => ls.map((l) => {
      const p = fills.get(l.employeeId);
      return p ? { ...l, attendance: p.attendance, absentDays: p.absentDays, lateMinutes: p.lateMinutes, otHours: 0, nightDiffHours: 0, dayHours: p.dayHours, absentHours: l.payBasis === "MONTHLY" ? h2(p.absentDays * hpd) : l.absentHours, lateHours: h2(p.lateMinutes / 60) } : l;
    }));
    const list = [...fills.values()];
    setFillInfo({
      filled: list.length,
      noEntries: (d.noEntries as string[]).map(nameOf),
      missing: list.filter((x) => x.missingDates.length).map((x) => ({ name: nameOf(x.employeeId), count: x.missingDates.length })),
      absent: list.filter((x) => x.absentDates.length).map((x) => ({ name: nameOf(x.employeeId), count: x.absentDates.length })),
    });
    if (list.length) setDirty(true);
    setMsg(list.length
      ? { ok: true, text: `Filled ${list.length} employee(s) from the timesheets. Review the figures, then Save.` }
      : { ok: false, text: "No timesheet entries found for this period. Encode them under Payroll › Timesheets first." });
  }

  const dates = useMemo(() => periodDates(run.periodStart, run.periodEnd), [run.periodStart, run.periodEnd]);
  const daily = lines.filter((l) => l.payBasis === "DAILY");
  /** Each employee's day types: the run's holidays plus their own rest days. */
  const typesByEmp = useMemo(() => {
    const m = new Map<string, Record<string, DayType>>();
    for (const l of lines) m.set(l.employeeId, employeeDayTypes(dayTypes, l.restDates));
    return m;
  }, [lines, dayTypes]);
  const typeFor = (l: Line, d: string): DayType => typesByEmp.get(l.employeeId)?.[d] ?? "REG";
  const runType = (d: string): DayType => holidayPart(dayTypes[d] ?? "REG");
  /** Ordinary workdays in the period for one employee (not a rest day or holiday). */
  const workdaysOf = (l: Line) => dates.filter((d) => typeFor(l, d) === "REG").length;
  /** Monthly-paid employees whose absences exceed their workdays in the period. */
  const overAbsent = lines.filter((l) => l.payBasis === "MONTHLY" && absentDaysOf(l) > workdaysOf(l));
  const flexible = lines.filter((l) => l.restDayMode === "FLEXIBLE");
  const flexibleUnmarked = flexible.filter((l) => l.restDates.length === 0);
  const [restOpen, setRestOpen] = useState(flexible.length > 0);
  // Flexible employees first so the processor sees who needs marking.
  const restRows = useMemo(() => [...lines].sort((a, b) => (a.restDayMode === b.restDayMode ? a.name.localeCompare(b.name) : a.restDayMode === "FLEXIBLE" ? -1 : 1)), [lines]);
  const sameDates = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  function toggleRest(l: Line, d: string) {
    const next = l.restDates.includes(d) ? l.restDates.filter((x) => x !== d) : [...l.restDates, d].sort();
    patch(l.employeeId, { restDates: next });
  }

  const results = useMemo(() => {
    const ctx = { periodStart: run.periodStart, periodEnd: run.periodEnd, payDate: run.payDate, dayTypes, rules, group };
    const map = new Map<string, LineResult>();
    for (const l of lines) {
      const adjustments: Adjustment[] = l.adjustments.flatMap((a) => {
        const it = items.find((i) => i.id === a.payItemId);
        return it && Number(a.amount) ? [{ payItemId: it.id, code: it.code, name: it.name, kind: it.kind, taxable: it.taxable, isOtherBenefit: it.isOtherBenefit, amount: Math.abs(Number(a.amount)) }] : [];
      });
      const r = computeLine({ ...l, absentDays: absentDaysOf(l), lateMinutes: lateMinutesOf(l), adjustments }, ctx);
      // Reimbursements go on top of net pay only (not gross, not taxed).
      map.set(l.employeeId, l.reimbursements ? { ...r, netPay: Math.round((r.netPay + l.reimbursements) * 100) / 100 } : r);
    }
    return map;
  }, [lines, dayTypes, rules, group, items, run.periodStart, run.periodEnd]);

  const totals = useMemo(() => {
    const t = { gross: 0, sss: 0, ph: 0, hdmf: 0, tax: 0, other: 0, ded: 0, net: 0, er: 0 };
    results.forEach((r) => {
      t.gross += r.grossPay; t.sss += r.sssEe; t.ph += r.philhealthEe; t.hdmf += r.hdmfEe; t.tax += r.withholdingTax;
      t.other += r.otherDeductions; t.ded += r.totalDeductions; t.net += r.netPay; t.er += r.sssEr + r.philhealthEr + r.hdmfEr;
    });
    return t;
  }, [results]);

  function patch(employeeId: string, p: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.employeeId === employeeId ? { ...l, ...p } : l)));
    setDirty(true);
  }
  function setCell(l: Line, date: string, v: string) {
    const att = { ...l.attendance };
    const n = Number(v);
    if (v === "" || !Number.isFinite(n) || n <= 0) delete att[date]; else att[date] = Math.min(n, 2);
    patch(l.employeeId, { attendance: att });
  }
  /** Marks every regular workday in the period as a full day for one or all daily-rate employees. */
  function fillRegular(only?: string) {
    setLines((ls) => ls.map((l) => {
      if (l.payBasis !== "DAILY" || (only && l.employeeId !== only)) return l;
      const att = { ...l.attendance };
      const onLeave = new Set(l.leaves.filter((x) => x.days >= 1).map((x) => x.date));
      const types = employeeDayTypes(dayTypes, l.restDates);
      for (const d of dates) if ((types[d] ?? "REG") === "REG" && att[d] == null && !onLeave.has(d)) att[d] = 1;
      return { ...l, attendance: att };
    }));
    setDirty(true);
  }
  function setDayType(date: string, t: DayType) {
    setDayTypes((d) => { const n = { ...d }; if (t === "REG") delete n[date]; else n[date] = holidayPart(t); return n; });
    setDirty(true);
  }

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Something went wrong." }); return false; }
    return true;
  }

  const payload = () => ({
    dayTypes, remarks,
    lines: lines.map((l) => ({ employeeId: l.employeeId, restDates: l.restDates, attendance: l.attendance, absentDays: Math.round(absentDaysOf(l) * 10000) / 10000, lateMinutes: h2(lateMinutesOf(l)), otHours: Number(l.otHours) || 0, nightDiffHours: Number(l.nightDiffHours) || 0, dayHours: l.dayHours, adjustments: l.adjustments.map((a) => ({ payItemId: a.payItemId, amount: Number(a.amount) || 0 })) })),
  });

  async function save() {
    if (await call(`/api/payroll/runs/${run.id}`, "PATCH", payload())) { setDirty(false); setMsg({ ok: true, text: "Saved." }); router.refresh(); }
  }
  async function post() {
    if (flexibleUnmarked.length && !confirm(`${flexibleUnmarked.length} employee(s) without a fixed rest day have no rest day marked in this period (${flexibleUnmarked.map((l) => l.name).join("; ")}). Their work on every date is paid as ordinary days. Continue anyway?`)) return;
    if (!confirm(`Post ${run.runNo} to the General Journal? Net pay ${formatPeso(totals.net)} for ${lines.length} employee(s). It can't be edited after posting.`)) return;
    if (overAbsent.length && !confirm(`Absences are more than the workdays in this period for: ${overAbsent.map((l) => l.name).join("; ")}. Their basic pay will be zero. Post anyway?`)) return;
    if (dirty && !(await call(`/api/payroll/runs/${run.id}`, "PATCH", payload()))) return;
    if (await call(`/api/payroll/runs/${run.id}/post`, "POST")) { setDirty(false); router.refresh(); }
  }
  async function remove() {
    if (!confirm(`Delete draft ${run.runNo}?`)) return;
    if (await call(`/api/payroll/runs/${run.id}`, "DELETE")) router.push("/payroll/runs");
  }
  async function cancelRun() {
    const reason = prompt(`Cancel posted run ${run.runNo}? This reverses its journal entry. Reason:`);
    if (!reason?.trim()) return;
    if (!(await call("/api/ledger-entries/cancel", "POST", { companyId, journalType: "GENERAL_JOURNAL", documentNo: run.runNo, reason }))) return;
    if (await call(`/api/payroll/runs/${run.id}/cancel`, "POST")) router.refresh();
  }
  async function addEmployee() {
    if (!addId) return;
    if (dirty && !(await call(`/api/payroll/runs/${run.id}`, "PATCH", payload()))) return;
    if (await call(`/api/payroll/runs/${run.id}`, "PATCH", { addEmployeeIds: [addId] })) { setAddId(""); window.location.reload(); }
  }
  async function removeEmployee(l: Line) {
    if (!confirm(`Remove ${l.name} from this run?`)) return;
    if (await call(`/api/payroll/runs/${run.id}`, "PATCH", { removeEmployeeIds: [l.employeeId] })) setLines((ls) => ls.filter((x) => x.employeeId !== l.employeeId));
  }

  const ro = !canEdit;

  /** Work, OT and night hours on specific dates, priced at that date's day type. */
  function renderDayHours(l: Line) {
    const entries = Object.entries(l.dayHours).sort(([a], [b]) => a.localeCompare(b));
    const setEntry = (date: string, h: DayHours | null, from?: string) => {
      const next = { ...l.dayHours };
      if (from && from !== date) delete next[from];
      if (h) next[date] = h; else delete next[date];
      patch(l.employeeId, { dayHours: next });
    };
    const free = dates.find((d) => !l.dayHours[d]);
    const monthly = l.payBasis === "MONTHLY";
    const inp = (v: number | undefined, onChange: (x: number) => void) => (
      <input value={v ? String(v) : ""} disabled={ro} inputMode="decimal" onChange={(e) => onChange(e.target.value as unknown as number)} className={cellInput} />
    );
    return (
      <div className="mt-3">
        <div className="text-[11px] font-medium text-neutral-600">Work by date <span className="font-normal text-neutral-400">(rest days, special days, holidays, and OT/night hours at that day&apos;s rate; the OT/ND columns above are for ordinary days)</span></div>
        {entries.length > 0 && (
          <table className="mt-1 text-[11px]">
            <thead><tr className="text-neutral-500"><th className="pr-2 text-left font-normal">Date</th>{monthly && <th className="pr-2 font-normal" title="Monthly-paid: worked this rest day/holiday (1 or 0.5)">Day worked</th>}<th className="pr-2 font-normal">OT hrs</th><th className="pr-2 font-normal">Night hrs</th><th className="pr-2 font-normal" title="OT hours that also fall 10pm–6am">Night OT hrs</th><th /></tr></thead>
            <tbody>
              {entries.map(([date, h]) => (
                <tr key={date}>
                  <td className="pr-2">
                    <select value={date} disabled={ro} onChange={(e) => setEntry(e.target.value, h, date)} className="rounded border border-neutral-300 px-1 py-0.5 text-[11px]">
                      {dates.filter((d) => d === date || !l.dayHours[d]).map((d) => <option key={d} value={d}>{mdy(d).slice(0, 5)} {WEEKDAY[dow(d)]} · {DAY_TYPE_SHORT[typeFor(l, d)]}</option>)}
                    </select>
                  </td>
                  {monthly && <td className="pr-2">{inp(h.days, (x) => setEntry(date, { ...h, days: x }))}</td>}
                  <td className="pr-2">{inp(h.ot, (x) => setEntry(date, { ...h, ot: x }))}</td>
                  <td className="pr-2">{inp(h.nd, (x) => setEntry(date, { ...h, nd: x }))}</td>
                  <td className="pr-2">{inp(h.ndOt, (x) => setEntry(date, { ...h, ndOt: x }))}</td>
                  <td>{canEdit && <button onClick={() => setEntry(date, null)} className="text-red-600 hover:underline">Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canEdit && free && <button onClick={() => setEntry(free, monthly ? { days: 1 } : { ot: 0 })} className="mt-1 text-[11px] text-brand-blue hover:underline">+ Add date</button>}
      </div>
    );
  }
  const num = (v: number) => (v ? formatPeso(v) : "–");

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium text-neutral-900">Payroll {run.runNo}</h1>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[run.status]}`}>{run.status}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {run.groupName}{run.branch ? ` · ${run.branch}` : ""} · Period {mdy(run.periodStart)} – {mdy(run.periodEnd)} · Pay date {mdy(run.payDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <>
            <button onClick={fillFromTimesheets} disabled={busy} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" title="Copy days worked, late, overtime and night hours from the timesheets encoded for this period">Fill from timesheets</button>
            <button onClick={() => setImporting(!importing)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Import biometrics</button>
            <button onClick={save} disabled={busy || !dirty} className="rounded border border-brand-blue px-3 py-1.5 text-sm text-brand-blue hover:bg-blue-50 disabled:opacity-40">Save</button>
            <button onClick={post} disabled={busy || lines.length === 0} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">Post to GL</button>
            <button onClick={remove} disabled={busy} className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Delete draft</button>
          </>}
          {canCancel && <button onClick={cancelRun} disabled={busy} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Cancel run</button>}
          <a href={`/payroll/runs/${run.id}/payslips`} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Payslips</a>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Print register</button>
        </div>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-green-700" : "text-red-600"} print:hidden`}>{msg.text}</p>}
      {dirty && canEdit && <p className="mt-2 text-xs text-amber-700 print:hidden">Unsaved changes. Figures below are a live preview.</p>}
      {fillInfo && (fillInfo.noEntries.length > 0 || fillInfo.missing.length > 0 || fillInfo.absent.length > 0) && (
        <div className="mt-2 space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden">
          {fillInfo.missing.length > 0 && <p><b>Workdays not encoded on the timesheet</b> (daily-rate staff aren&apos;t paid for them yet; monthly staff aren&apos;t deducted): {fillInfo.missing.map((m) => `${m.name} (${m.count})`).join("; ")}.</p>}
          {fillInfo.absent.length > 0 && <p><b>Marked absent:</b> {fillInfo.absent.map((m) => `${m.name} (${m.count})`).join("; ")}.</p>}
          {fillInfo.noEntries.length > 0 && <p><b>No timesheet entries at all</b> (left as they were): {fillInfo.noEntries.join("; ")}.</p>}
        </div>
      )}

      {/* Totals */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 print:hidden">
        {[["Employees", String(lines.length)], ["Gross pay", formatPeso(totals.gross)], ["Deductions", formatPeso(totals.ded)], ["Net pay", formatPeso(totals.net)], ["Employer share", formatPeso(totals.er)]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-neutral-200 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-neutral-500">{k}</div><div className="font-mono text-lg text-neutral-900">{v}</div></div>
        ))}
      </div>

      {importing && canEdit && (
        <BiometricImport
          periodStart={run.periodStart}
          periodEnd={run.periodEnd}
          shift={shift}
          hoursPerDay={hpd}
          lines={lines.map((l) => ({
            employeeId: l.employeeId, code: l.code, name: l.name, payBasis: l.payBasis, biometricId: l.biometricId,
            shiftStart: l.shiftStart, shiftEnd: l.shiftEnd, leaveDates: l.leaves.map((x) => x.date),
            dayTypes: typesByEmp.get(l.employeeId) ?? {},
          }))}
          onApply={applyImport}
          onClose={() => setImporting(false)}
        />
      )}

      {/* Day types of the period (DOLE handbook pay rates apply per date) */}
      <section className="mt-6 rounded-lg border border-neutral-200 p-4 print:hidden">
        <h2 className="text-sm font-medium text-neutral-800">Holidays in this period</h2>
        <p className="text-xs text-neutral-500">Mark special days and regular holidays (from the President&apos;s proclamation). Rest days are per employee (below). Pay for work on each date, overtime (125% ordinary, 130% of the day&apos;s rate otherwise) and night shift (+10%) follow the day type; a holiday on an employee&apos;s rest day uses the &ldquo;+R&rdquo; rate. A special <i>working</i> day is an ordinary day.{canEdit && <> If you use timesheets, press <b>Fill from timesheets</b> again after changing holidays or rest days so monthly-paid staff are worked out against them.</>}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {dates.map((d) => {
            const t = runType(d);
            return (
              <div key={d} className={`rounded border border-neutral-200 px-1 py-0.5 text-center text-[10px] ${DAY_TYPE_STYLE[t]}`} title={`${DAY_TYPE_LABEL[t]}: ${Math.round(dayMultiplier(t, rules) * 100)}% if worked`}>
                <div className="text-neutral-400">{WEEKDAY[dow(d)]} <b className="text-neutral-700">{d.slice(8)}</b></div>
                <select value={t} disabled={ro} onChange={(e) => setDayType(d, e.target.value as DayType)} className="w-16 rounded border border-neutral-200 bg-transparent text-[10px] disabled:border-transparent">
                  {HOLIDAY_TYPES.map((x) => <option key={x} value={x} title={DAY_TYPE_LABEL[x]}>{DAY_TYPE_SHORT[x]}</option>)}
                </select>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-neutral-400">Ord ordinary · SH special day · 2SH double special · RH regular holiday · 2RH double holiday</p>
      </section>

      {/* Rest days per employee */}
      <section className={`mt-6 rounded-lg border p-4 print:hidden ${flexibleUnmarked.length ? "border-amber-300" : "border-neutral-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-neutral-800">
              Rest days
              {flexible.length > 0 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{flexible.length} without fixed rest day</span>}
            </h2>
            <p className="text-xs text-neutral-500">Fixed rest days fill in automatically from each employee&apos;s schedule. Employees <b>without a fixed rest day</b> (highlighted) need their rest days marked here every run. Click a date to mark or unmark it.</p>
          </div>
          <button onClick={() => setRestOpen(!restOpen)} className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50">{restOpen ? "Hide" : "Show"} rest days</button>
        </div>
        {flexibleUnmarked.length > 0 && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            No rest day marked yet for {flexibleUnmarked.length} employee(s): {flexibleUnmarked.map((l) => l.name).join("; ")}.
          </p>
        )}
        {restOpen && lines.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[14rem] bg-white py-1 pr-3 text-left font-medium text-neutral-500">Employee</th>
                  {dates.map((d) => (
                    <th key={d} className={`px-0.5 py-1 text-center font-normal ${DAY_TYPE_STYLE[runType(d)]}`}>
                      <div className="text-neutral-400">{WEEKDAY[dow(d)]}</div>
                      <div className="font-medium text-neutral-700">{d.slice(8)}</div>
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right font-medium text-neutral-500">Rest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {restRows.map((l) => {
                  const flex = l.restDayMode === "FLEXIBLE";
                  const changed = !flex && !sameDates(l.restDates, l.scheduledRest);
                  const rowBg = flex ? (l.restDates.length ? "bg-amber-50" : "bg-amber-100") : "bg-white";
                  return (
                    <tr key={l.employeeId} className={flex ? "bg-amber-50/60" : ""}>
                      <td className={`sticky left-0 z-10 py-1 pr-3 ${rowBg}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-800">{l.name}</span>
                          {flex
                            ? <span className="rounded bg-amber-200 px-1 text-[10px] font-medium text-amber-900" title="No fixed rest day: mark it every run">Flexible</span>
                            : <span className="rounded bg-neutral-100 px-1 text-[10px] text-neutral-500" title="Filled from the employee's fixed schedule">Fixed</span>}
                        </div>
                        {changed && <div className="text-[10px] text-neutral-500">changed from schedule{canEdit && <> · <button onClick={() => patch(l.employeeId, { restDates: l.scheduledRest })} className="text-brand-blue hover:underline">reset</button></>}</div>}
                        {flex && !l.restDates.length && <div className="text-[10px] font-medium text-amber-800">no rest day marked</div>}
                      </td>
                      {dates.map((d) => {
                        const rest = l.restDates.includes(d);
                        return (
                          <td key={d} className="px-0.5 py-1 text-center">
                            <button
                              disabled={ro}
                              onClick={() => toggleRest(l, d)}
                              title={rest ? "Rest day: click to unmark" : "Click to mark as rest day"}
                              className={`h-6 w-8 rounded border text-[10px] ${rest ? (flex ? "border-amber-500 bg-amber-300 font-medium text-amber-900" : "border-neutral-400 bg-neutral-300 font-medium text-neutral-800") : "border-neutral-200 text-neutral-300 hover:bg-neutral-50"} disabled:cursor-default`}
                            >{rest ? "R" : "·"}</button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-right font-mono">{l.restDates.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Daily attendance grid */}
      {daily.length > 0 && (
        <section className="mt-6 rounded-lg border border-neutral-200 p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-neutral-800">Daily attendance: daily-rate employees ({daily.length})</h2>
              <p className="text-xs text-neutral-500">Days worked per date (1 = full day, 0.5 = half day). Rest days and holidays apply their premium automatically. An unworked regular holiday is paid if the employee was present or on paid leave the workday before. Approved leave shows as a code (e.g. SIL) and is paid when the leave is with pay. Enter overtime and night hours on rest days/holidays under each employee&apos;s Items.</p>
            </div>
            {canEdit && <button onClick={() => fillRegular()} className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50">Fill regular days for everyone</button>}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[12rem] bg-white py-1 pr-3 text-left font-medium text-neutral-500">Employee</th>
                  {dates.map((d) => (
                    <th key={d} className={`px-0.5 py-1 text-center font-normal ${DAY_TYPE_STYLE[runType(d)]}`}>
                      <div className="text-neutral-400">{WEEKDAY[dow(d)]}</div>
                      <div className="font-medium text-neutral-700">{d.slice(8)}</div>
                      <div className="text-[10px] text-neutral-500" title={DAY_TYPE_LABEL[runType(d)]}>{runType(d) === "REG" ? "" : DAY_TYPE_SHORT[runType(d)]}</div>
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right font-medium text-neutral-500">Days</th>
                  <th className="px-2 py-1 text-right font-medium text-neutral-500">Rate</th>
                  <th className="px-2 py-1 text-right font-medium text-neutral-500">Basic + prem.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {daily.map((l) => {
                  const r = results.get(l.employeeId)!;
                  return (
                    <tr key={l.employeeId}>
                      <td className={`sticky left-0 z-10 py-1 pr-3 ${l.restDayMode === "FLEXIBLE" ? "bg-amber-50" : "bg-white"}`}>
                        <div className="text-neutral-800">{l.name}{l.restDayMode === "FLEXIBLE" && <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] font-medium text-amber-900" title="No fixed rest day: rest days are marked in the Rest days section">Flexible</span>}</div>
                        {canEdit && <button onClick={() => fillRegular(l.employeeId)} className="text-[10px] text-brand-blue hover:underline">fill regular days</button>}
                      </td>
                      {dates.map((d) => {
                        const lv = l.leaves.find((x) => x.date === d);
                        const t = typeFor(l, d);
                        return (
                          <td key={d} className={`px-0.5 py-1 text-center ${DAY_TYPE_STYLE[t]}`} title={DAY_TYPE_LABEL[t]}>
                            {t !== runType(d) && <div className="text-[9px] leading-none text-neutral-500">rest</div>}
                            {lv && <div title={`${lv.code}${lv.days < 1 ? " (half day)" : ""}${lv.paid ? ", with pay" : ", without pay"}`} className={`mx-auto mb-0.5 w-10 rounded px-0.5 text-[10px] font-medium ${lv.paid ? "bg-blue-100 text-brand-blue" : "bg-neutral-200 text-neutral-600"}`}>{lv.code}{lv.days < 1 ? "½" : ""}</div>}
                            {(!lv || lv.days < 1 || l.attendance[d] != null) && <input value={l.attendance[d] ?? ""} disabled={ro} inputMode="decimal" onChange={(e) => setCell(l, d, e.target.value)} className={`${cellInput} w-10 text-center`} />}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-right font-mono">{r.daysWorked}</td>
                      <td className="px-2 py-1 text-right font-mono">{formatPeso(l.rate)}</td>
                      <td className="px-2 py-1 text-right font-mono">{formatPeso(r.basicPay + r.holidayPay + r.premiumPay + r.leavePay)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Register */}
      <section className="mt-6 rounded-lg border border-neutral-200 p-4 print:border-0 print:p-0">
        <div className="hidden print:block">
          <h1 className="text-base font-semibold">Payroll Register: {run.runNo}</h1>
          <p className="text-xs">{run.groupName}{run.branch ? ` · ${run.branch}` : ""} · {mdy(run.periodStart)} – {mdy(run.periodEnd)} · Pay date {mdy(run.payDate)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <h2 className="text-sm font-medium text-neutral-800">Payroll register</h2>
          {canEdit && available.length > 0 && (
            <div className="flex items-center gap-2">
              <select value={addId} onChange={(e) => setAddId(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-xs">
                <option value="">Add employee from this pay group…</option>
                {available.map((a) => <option key={a.employeeId} value={a.employeeId}>{a.label}</option>)}
              </select>
              <button onClick={addEmployee} disabled={!addId || busy} className="rounded border border-brand-blue px-2 py-1 text-xs text-brand-blue hover:bg-blue-50 disabled:opacity-40">Add</button>
            </div>
          )}
        </div>
        {lines.length === 0 && <p className="mt-3 text-sm text-neutral-500">No employees in this run. Assign employees to the &ldquo;{run.groupName}&rdquo; pay group under Payroll › Employees.</p>}
        {lines.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-left uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-2">Employee</th>
                  <th className="py-2 pr-2 text-right" title={`Monthly-paid: hours absent (${hpd} hrs = 1 day)`}>Absent hrs</th>
                  <th className="py-2 pr-2 text-right" title="Late + undertime, in hours (15 min = 0.25)">Late hrs</th>
                  <th className="py-2 pr-2 text-right">OT hrs</th>
                  <th className="py-2 pr-2 text-right">ND hrs</th>
                  <th className="py-2 pr-2 text-right" title="Approved leave in the period">Leave</th>
                  <th className="py-2 pr-2 text-right">Basic</th>
                  <th className="py-2 pr-2 text-right">Prem/OT/ND</th>
                  <th className="py-2 pr-2 text-right">Other earn.</th>
                  <th className="py-2 pr-2 text-right">Gross</th>
                  <th className="py-2 pr-2 text-right">SSS</th>
                  <th className="py-2 pr-2 text-right">PhilHealth</th>
                  <th className="py-2 pr-2 text-right">Pag-IBIG</th>
                  <th className="py-2 pr-2 text-right">W/tax</th>
                  <th className="py-2 pr-2 text-right">Other ded.</th>
                  <th className="py-2 pr-2 text-right">Net pay</th>
                  <th className="py-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((l) => {
                  const r = results.get(l.employeeId)!;
                  const open = expanded === l.employeeId;
                  return (
                    <Fragment key={l.employeeId}>
                      <tr className="align-top">
                        <td className="py-1.5 pr-2">
                          <div className="text-sm text-neutral-800">{l.name}{l.restDayMode === "FLEXIBLE" && <span className={`ml-1 rounded px-1 text-[10px] font-medium ${l.restDates.length ? "bg-amber-100 text-amber-800" : "bg-amber-300 text-amber-900"}`} title={l.restDates.length ? `Flexible rest day: ${l.restDates.map((d) => d.slice(5)).join(", ")}` : "Flexible rest day: none marked yet"}>{l.restDates.length ? "Flexible rest" : "No rest day marked"}</span>}</div>
                          <div className="text-[10px] text-neutral-400">{l.code} · {formatPeso(l.rate)}{l.payBasis === "DAILY" ? "/day" : "/mo"}{l.isMinimumWage ? " · MWE" : ""}</div>
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          {l.payBasis === "MONTHLY"
                            ? (() => {
                                const wd = workdaysOf(l);
                                const over = absentDaysOf(l) > wd;
                                return (
                                  <>
                                    <input value={String(l.absentHours || "")} disabled={ro} inputMode="decimal" title={`Hours absent. ${wd} workday(s) × ${hpd} hrs = ${wd * hpd} hrs in this period.`} onChange={(e) => patch(l.employeeId, { absentHours: e.target.value as unknown as number })} className={`${cellInput} ${over ? "border-red-500 bg-red-50 text-red-700" : ""}`} />
                                    <div className={`mt-0.5 text-[10px] ${over ? "font-medium text-red-600" : "text-neutral-400"}`}>{over ? `max ${h2(wd * hpd)} hrs` : `of ${h2(wd * hpd)} hrs`}</div>
                                  </>
                                );
                              })()
                            : <span className="text-neutral-300" title="Daily-rate: use the attendance grid">grid</span>}
                        </td>
                        {(["lateHours", "otHours", "nightDiffHours"] as const).map((k) => (
                          <td key={k} className="py-1.5 pr-2 text-right">
                            <input value={String(l[k] || "")} disabled={ro} inputMode="decimal" onChange={(e) => patch(l.employeeId, { [k]: e.target.value as unknown as number })} className={cellInput} />
                          </td>
                        ))}
                        <td className="py-1.5 pr-2 text-right text-[11px]">
                          {r.leaveDays > 0 && <div title={l.payBasis === "DAILY" ? "Paid leave at the daily rate" : "Paid leave (covered by the salary)"}>{r.leaveDays}d{r.leavePay ? ` · ${formatPeso(r.leavePay)}` : ""}</div>}
                          {r.unpaidLeaveDays > 0 && <div className="text-neutral-500" title={l.payBasis === "MONTHLY" ? "Deducted like an absence" : "Not paid"}>{r.unpaidLeaveDays}d no pay</div>}
                          {!r.leaveDays && !r.unpaidLeaveDays && <span className="text-neutral-300">–</span>}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono" title={r.holidayPay ? `Incl. holiday pay ${formatPeso(r.holidayPay)}` : undefined}>{num(r.basicPay + r.leavePay + r.holidayPay)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">{num(r.premiumPay + r.otPay + r.nightDiffPay - r.lateDeduction)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono" title={r.leaveConversionPay ? `Incl. ${r.leaveConversionDays} day(s) unused leave converted: ${formatPeso(r.leaveConversionPay)}` : undefined}>{num(r.otherEarnings + r.leaveConversionPay)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono font-medium">{num(r.grossPay)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">{num(r.sssEe)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">{num(r.philhealthEe)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">{num(r.hdmfEe)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">{num(r.withholdingTax)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">{num(r.otherDeductions)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono font-semibold" title={l.reimbursements ? `Incl. reimbursements ${formatPeso(l.reimbursements)} (not taxed)` : undefined}>
                          {formatPeso(r.netPay)}
                          {l.reimbursements > 0 && <div className="text-[10px] font-normal text-blue-700">incl. reimb. {formatPeso(l.reimbursements)}</div>}
                        </td>
                        <td className="whitespace-nowrap py-1.5 text-right print:hidden">
                          <button onClick={() => setExpanded(open ? null : l.employeeId)} className="rounded px-1.5 py-0.5 text-[11px] text-brand-blue hover:bg-blue-50">{open ? "Hide" : `Items${l.adjustments.length ? ` (${l.adjustments.length})` : ""}`}</button>
                          {canEdit && <button onClick={() => removeEmployee(l)} className="rounded px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50">×</button>}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-neutral-50 print:hidden">
                          <td colSpan={17} className="px-3 py-2">
                            <div className="text-[11px] font-medium text-neutral-600">Earnings & deductions for this run</div>
                            {l.adjustments.map((a, i) => (
                              <div key={i} className="mt-1 flex items-center gap-2">
                                <select value={a.payItemId} disabled={ro} onChange={(e) => patch(l.employeeId, { adjustments: l.adjustments.map((x, j) => (j === i ? { ...x, payItemId: e.target.value } : x)) })} className="w-64 rounded border border-neutral-300 px-2 py-1 text-xs">
                                  <option value="">Select item…</option>
                                  {items.filter((it) => it.isActive || it.id === a.payItemId).map((it) => <option key={it.id} value={it.id}>{it.kind === "EARNING" ? "+" : "−"} {it.name}</option>)}
                                </select>
                                <input value={String(a.amount)} disabled={ro} inputMode="decimal" onChange={(e) => patch(l.employeeId, { adjustments: l.adjustments.map((x, j) => (j === i ? { ...x, amount: e.target.value as unknown as number } : x)) })} className="w-28 rounded border border-neutral-300 px-2 py-1 text-right font-mono text-xs" />
                                {canEdit && <button onClick={() => patch(l.employeeId, { adjustments: l.adjustments.filter((_, j) => j !== i) })} className="text-[11px] text-red-600 hover:underline">Remove</button>}
                              </div>
                            ))}
                            {canEdit && <button onClick={() => patch(l.employeeId, { adjustments: [...l.adjustments, { payItemId: "", amount: 0 }] })} className="mt-1 text-[11px] text-brand-blue hover:underline">+ Add item</button>}
                            {renderDayHours(l)}
                            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] text-neutral-500 sm:grid-cols-4">
                              <span>Days worked: <b>{r.daysWorked}</b></span>
                              <span>Taxable income: <b>{formatPeso(r.taxableIncome)}</b></span>
                              <span>Late/undertime: <b>{formatPeso(r.lateDeduction)}</b></span>
                              <span>Employer share: <b>{formatPeso(r.sssEr + r.philhealthEr + r.hdmfEr)}</b></span>
                              {l.leaves.length > 0 && <span className="col-span-2 sm:col-span-4">Leave: {l.leaves.map((x) => `${x.code} ${x.date.slice(5)}${x.days < 1 ? " (½)" : ""}`).join(", ")}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 font-mono font-medium">
                  <td className="py-2 pr-2 font-sans text-xs uppercase text-neutral-500" colSpan={9}>Totals</td>
                  <td className="py-2 pr-2 text-right">{formatPeso(totals.gross)}</td>
                  <td className="py-2 pr-2 text-right">{formatPeso(totals.sss)}</td>
                  <td className="py-2 pr-2 text-right">{formatPeso(totals.ph)}</td>
                  <td className="py-2 pr-2 text-right">{formatPeso(totals.hdmf)}</td>
                  <td className="py-2 pr-2 text-right">{formatPeso(totals.tax)}</td>
                  <td className="py-2 pr-2 text-right">{formatPeso(totals.other)}</td>
                  <td className="py-2 pr-2 text-right">{formatPeso(totals.net)}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <label className="mt-4 block text-xs text-neutral-500 print:hidden">
          Remarks
          <input value={remarks} disabled={ro} onChange={(e) => { setRemarks(e.target.value); setDirty(true); }} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-50" />
        </label>
      </section>
    </div>
  );
}
