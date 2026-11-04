"use client";

import { Fragment, useMemo, useState } from "react";
import type { DayType, PayBasis } from "@/lib/payroll/compute";
import {
  atTime, computeDays, detectMapping, extractPunches, normId, toLinePatch,
  type DateOrder, type DayTime, type Grid, type LinePatch, type Mapping, type Shift,
} from "@/lib/payroll/biometric";

export type BioLine = {
  employeeId: string; code: string; name: string; payBasis: PayBasis;
  biometricId: string | null; shiftStart: string | null; shiftEnd: string | null; leaveDates: string[];
  dayTypes: Record<string, DayType>; // this employee's day types (run holidays + own rest days)
};

type Layout = "datetime" | "datePlusTime" | "inOut";
const sel = "rounded border border-neutral-300 px-2 py-1 text-xs";
const mdy = (iso: string) => { const [, m, d] = iso.split("-"); return `${m}/${d}`; };
const layoutOf = (m: Mapping): Layout => (m.inCol != null ? "inOut" : m.dateTimeCol != null ? "datetime" : "datePlusTime");

/**
 * Import attendance from a biometric device export into a draft run: upload,
 * check the detected columns, preview per employee, then apply. Applying
 * replaces attendance, absences, late/undertime and OT/night hours of the
 * employees found in the file; everyone else is left as is.
 */
const hrs = (v: number) => Math.round(v * 100) / 100;

export function BiometricImport({ periodStart, periodEnd, shift, hoursPerDay, lines, onApply, onClose }: {
  periodStart: string; periodEnd: string; shift: Shift; hoursPerDay: number; lines: BioLine[];
  onApply: (patches: Map<string, LinePatch>) => void; onClose: () => void;
}) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [fileName, setFileName] = useState("");
  const [map, setMap] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setError(null); setGrid(null); setMap(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/payroll/biometrics/parse", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error ?? "Could not read the file.");
    setFileName(file.name);
    setGrid(d.grid);
    setMap(detectMapping(d.grid));
  }

  const cols = useMemo(() => Math.max(0, ...(grid ?? []).slice(0, 50).map((r) => r.length)), [grid]);
  const colName = (i: number) => (map?.hasHeader && grid?.[0]?.[i] ? `${String.fromCharCode(65 + i)} · ${grid[0][i]}` : `Column ${String.fromCharCode(65 + i)}`);

  const result = useMemo(() => {
    if (!grid || !map) return null;
    const { punches, skipped } = extractPunches(grid, map);
    const byId = new Map<string, number[]>();
    for (const p of punches) { const k = normId(p.id); byId.set(k, [...(byId.get(k) ?? []), p.at]); }
    const lineById = new Map(lines.map((l) => [normId(l.biometricId || l.code), l]));
    const matched: { line: BioLine; deviceId: string; days: DayTime[]; patch: LinePatch }[] = [];
    const unmatched: string[] = [];
    for (const [id, ats] of byId) {
      const line = lineById.get(id);
      if (!line) { unmatched.push(id); continue; }
      const s = line.shiftStart && line.shiftEnd ? { ...shift, start: line.shiftStart, end: line.shiftEnd } : shift;
      const days = computeDays(ats, s, periodStart, periodEnd);
      matched.push({ line, deviceId: id, days, patch: toLinePatch(days, line.payBasis, periodStart, periodEnd, line.dayTypes, new Set(line.leaveDates)) });
    }
    matched.sort((a, b) => a.line.name.localeCompare(b.line.name));
    const found = new Set(matched.map((m) => m.line.employeeId));
    return { punches: punches.length, skipped, matched, unmatched: unmatched.sort(), missing: lines.filter((l) => !found.has(l.employeeId)) };
  }, [grid, map, lines, shift, periodStart, periodEnd]);

  function setLayout(l: Layout) {
    if (!map) return;
    const guess: Mapping = { ...map, dateTimeCol: null, dateCol: null, timeCol: null, inCol: null, outCol: null };
    const other = (avoid: (number | null)[]) => { for (let c = 0; c < cols; c++) if (!avoid.includes(c)) return c; return 0; };
    if (l === "datetime") guess.dateTimeCol = map.dateTimeCol ?? map.dateCol ?? other([map.idCol]);
    if (l === "datePlusTime") { guess.dateCol = map.dateCol ?? other([map.idCol]); guess.timeCol = map.timeCol ?? other([map.idCol, guess.dateCol]); }
    if (l === "inOut") { guess.dateCol = map.dateCol ?? other([map.idCol]); guess.inCol = map.inCol ?? other([map.idCol, guess.dateCol]); guess.outCol = map.outCol ?? other([map.idCol, guess.dateCol, guess.inCol]); }
    setMap(guess);
  }
  const colSelect = (key: keyof Mapping, value: number | null) => (
    <select value={value ?? ""} onChange={(e) => setMap({ ...map!, [key]: Number(e.target.value) })} className={sel}>
      {Array.from({ length: cols }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
    </select>
  );

  const sum = (d: DayTime[], k: "days" | "lateMinutes" | "otHours" | "ndHours" | "ndOtHours") => Math.round(d.filter((x) => !x.incomplete).reduce((s, x) => s + x[k], 0) * 100) / 100;

  return (
    <section className="mt-6 rounded-lg border border-brand-blue/40 bg-blue-50/30 p-4 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-neutral-800">Import biometric attendance</h2>
          <p className="max-w-3xl text-xs text-neutral-500">
            Upload the device export for this period (CSV, TXT, DAT such as ZKTeco attlog, or XLSX), with one row per punch or one row per day with time in/out.
            Employees are matched by Biometric ID (or employee code). Punches are compared with the shift ({shift.start}–{shift.end}, {shift.breakMinutes} min break,
            {" "}{shift.lateGraceMinutes} min grace) to get late/undertime, overtime and night hours (10pm–6am). First punch of the day = in, last = out.
          </p>
        </div>
        <button onClick={onClose} className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50">Close</button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,.txt,.dat,.log,.xlsx" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="text-xs" />
        {busy && <span className="text-xs text-neutral-500">Reading…</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {grid && map && result && (
        <>
          <div className="mt-4 rounded border border-neutral-200 bg-white p-3">
            <div className="text-xs font-medium text-neutral-700">Columns in {fileName} <span className="font-normal text-neutral-400">({grid.length} rows, detected automatically; adjust if needed)</span></div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-700">
              <label className="flex items-center gap-1"><input type="checkbox" checked={map.hasHeader} onChange={(e) => setMap({ ...map, hasHeader: e.target.checked })} /> First row is a header</label>
              <label className="flex items-center gap-1">Layout
                <select value={layoutOf(map)} onChange={(e) => setLayout(e.target.value as Layout)} className={sel}>
                  <option value="datetime">One punch per row (date &amp; time in one column)</option>
                  <option value="datePlusTime">One punch per row (date and time columns)</option>
                  <option value="inOut">One row per day (time in / time out)</option>
                </select>
              </label>
              <label className="flex items-center gap-1">Employee ID {colSelect("idCol", map.idCol)}</label>
              {map.dateTimeCol != null && <label className="flex items-center gap-1">Date &amp; time {colSelect("dateTimeCol", map.dateTimeCol)}</label>}
              {map.dateCol != null && <label className="flex items-center gap-1">Date {colSelect("dateCol", map.dateCol)}</label>}
              {map.timeCol != null && <label className="flex items-center gap-1">Time {colSelect("timeCol", map.timeCol)}</label>}
              {map.inCol != null && <label className="flex items-center gap-1">Time in {colSelect("inCol", map.inCol)}</label>}
              {map.outCol != null && <label className="flex items-center gap-1">Time out {colSelect("outCol", map.outCol)}</label>}
              <label className="flex items-center gap-1">Date format
                <select value={map.dateOrder} onChange={(e) => setMap({ ...map, dateOrder: e.target.value as DateOrder })} className={sel}>
                  <option value="MDY">Month/Day/Year</option><option value="DMY">Day/Month/Year</option><option value="YMD">Year-Month-Day</option>
                </select>
              </label>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="text-[11px] text-neutral-600">
                <tbody>
                  {grid.slice(0, 5).map((r, i) => (
                    <tr key={i} className={i === 0 && map.hasHeader ? "font-medium text-neutral-800" : ""}>
                      {Array.from({ length: cols }, (_, c) => <td key={c} className="border border-neutral-100 px-1.5 py-0.5">{r[c] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-600">
            {result.punches} punches read{result.skipped ? `, ${result.skipped} row(s) skipped (unreadable)` : ""} · {result.matched.length} employee(s) matched
            {result.unmatched.length > 0 && <span className="text-amber-700"> · Not in this run / unknown device IDs: {result.unmatched.slice(0, 20).join(", ")}{result.unmatched.length > 20 ? "…" : ""}</span>}
            {result.missing.length > 0 && <span className="text-neutral-500"> · No punches (left unchanged): {result.missing.map((m) => m.name).slice(0, 10).join("; ")}{result.missing.length > 10 ? "…" : ""}</span>}
          </div>

          {result.matched.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded border border-neutral-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-left uppercase tracking-wide text-neutral-500">
                    <th className="px-2 py-1.5">Employee</th><th className="px-2 py-1.5">Device ID</th>
                    <th className="px-2 py-1.5 text-right">Days present</th><th className="px-2 py-1.5 text-right" title="Monthly-paid: ordinary workdays without punches or approved leave, in hours">Absent hrs</th>
                    <th className="px-2 py-1.5 text-right">Late/under hrs</th><th className="px-2 py-1.5 text-right">OT hrs</th>
                    <th className="px-2 py-1.5 text-right">Night hrs</th><th className="px-2 py-1.5 text-right">Night OT</th><th className="px-2 py-1.5">Check</th><th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {result.matched.map(({ line, deviceId, days, patch }) => {
                    const incomplete = days.filter((d) => d.incomplete);
                    const isOpen = open === line.employeeId;
                    return (
                      <Fragment key={line.employeeId}>
                        <tr>
                          <td className="px-2 py-1">{line.name} <span className="text-[10px] text-neutral-400">{line.payBasis === "DAILY" ? "daily" : "monthly"}</span></td>
                          <td className="px-2 py-1 font-mono">{deviceId}</td>
                          <td className="px-2 py-1 text-right font-mono">{sum(days, "days")}</td>
                          <td className="px-2 py-1 text-right font-mono">{line.payBasis === "MONTHLY" ? hrs(patch.absentDays * hoursPerDay) : "–"}</td>
                          <td className="px-2 py-1 text-right font-mono">{hrs(patch.lateMinutes / 60)}</td>
                          <td className="px-2 py-1 text-right font-mono">{sum(days, "otHours")}</td>
                          <td className="px-2 py-1 text-right font-mono">{sum(days, "ndHours")}</td>
                          <td className="px-2 py-1 text-right font-mono">{sum(days, "ndOtHours")}</td>
                          <td className="px-2 py-1">{incomplete.length ? <span className="text-amber-700" title="Only one punch: not counted. Fix in the grid after importing.">{incomplete.length} single punch: {incomplete.map((d) => mdy(d.date)).join(", ")}</span> : <span className="text-green-700">OK</span>}</td>
                          <td className="px-2 py-1 text-right"><button onClick={() => setOpen(isOpen ? null : line.employeeId)} className="text-brand-blue hover:underline">{isOpen ? "Hide" : "Days"}</button></td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-neutral-50">
                            <td colSpan={10} className="px-3 py-2">
                              <table className="text-[11px]">
                                <thead><tr className="text-neutral-500"><th className="pr-3 text-left font-normal">Date</th><th className="pr-3 font-normal">Type</th><th className="pr-3 font-normal">In</th><th className="pr-3 font-normal">Out</th><th className="pr-3 font-normal">Day</th><th className="pr-3 font-normal">Late/under hrs</th><th className="pr-3 font-normal">OT</th><th className="pr-3 font-normal">Night</th><th className="pr-3 font-normal">Night OT</th></tr></thead>
                                <tbody>
                                  {days.map((d) => (
                                    <tr key={d.date} className={d.incomplete ? "text-amber-700" : ""}>
                                      <td className="pr-3">{mdy(d.date)}</td><td className="pr-3 text-center">{line.dayTypes[d.date] ?? "REG"}</td>
                                      <td className="pr-3 text-center font-mono">{d.in != null ? atTime(d.in) : "–"}</td>
                                      <td className="pr-3 text-center font-mono">{d.out != null ? atTime(d.out) : "missing"}</td>
                                      <td className="pr-3 text-center font-mono">{d.days || "–"}</td><td className="pr-3 text-center font-mono">{d.lateMinutes ? hrs(d.lateMinutes / 60) : "–"}</td>
                                      <td className="pr-3 text-center font-mono">{d.otHours || "–"}</td><td className="pr-3 text-center font-mono">{d.ndHours || "–"}</td><td className="pr-3 text-center font-mono">{d.ndOtHours || "–"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onApply(new Map(result.matched.map((m) => [m.line.employeeId, m.patch])))}
              disabled={result.matched.length === 0}
              className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50"
            >
              Apply to {result.matched.length} employee(s)
            </button>
            <span className="text-xs text-neutral-500">Replaces their attendance, absences, late/undertime, OT and night hours in this run. Set the period&apos;s rest days and holidays first so premiums apply. Review, then Save.</span>
          </div>
        </>
      )}
    </section>
  );
}
