"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CREDIT_BASIS_LABEL, type EmploymentType, type LeaveAccrual, type LeaveCreditBasis, type LeaveEligibility } from "@/lib/payroll/leave";
import { EMPLOYMENT_LABEL } from "../employees/PayrollEmployeesClient";

export type LeaveTypeRow = {
  id: string; code: string; name: string; description: string; legalBasis: string; isStatutory: boolean;
  isPaid: boolean; creditBasis: LeaveCreditBasis; days: number; accrual: LeaveAccrual; countCalendarDays: boolean;
  allowHalfDay: boolean; allowNegative: boolean; minServiceMonths: number; eligibility: LeaveEligibility;
  soloParentOnly: boolean; employmentTypes: EmploymentType[]; maxCarryOver: number; convertibleToCash: boolean; isActive: boolean;
  soloParentExtraDays: number; maxFilings: number | null; maxDaysPerYear: number | null;
};

const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const label = "block text-xs text-neutral-500";
const check = "flex items-center gap-2 text-sm text-neutral-700";

const blank: Omit<LeaveTypeRow, "id"> = {
  code: "", name: "", description: "", legalBasis: "", isStatutory: false, isPaid: true, creditBasis: "ANNUAL", days: 5, accrual: "UPFRONT",
  countCalendarDays: false, allowHalfDay: true, allowNegative: false, minServiceMonths: 0, eligibility: "ANY", soloParentOnly: false,
  employmentTypes: [], maxCarryOver: 0, convertibleToCash: false, isActive: true, soloParentExtraDays: 0, maxFilings: null, maxDaysPerYear: null,
};

function summary(t: LeaveTypeRow): string {
  if (t.creditBasis === "UNLIMITED") return "No limit";
  const unit = t.countCalendarDays ? "calendar days" : "days";
  const base = t.creditBasis === "ANNUAL" ? `${t.days} ${unit}/yr${t.accrual === "MONTHLY" ? ", earned monthly" : ""}` : `Up to ${t.days} ${unit} per filing`;
  return [
    base,
    t.soloParentExtraDays ? `+${t.soloParentExtraDays} for solo parents` : "",
    t.maxDaysPerYear != null ? `max ${t.maxDaysPerYear}/yr` : "",
    t.maxFilings != null ? `max ${t.maxFilings} filings` : "",
  ].filter(Boolean).join(" · ");
}

function who(t: LeaveTypeRow): string {
  const parts: string[] = [];
  if (t.eligibility !== "ANY") parts.push(t.eligibility === "FEMALE" ? "Women" : "Men");
  if (t.soloParentOnly) parts.push("Solo parents");
  if (t.employmentTypes.length) parts.push(t.employmentTypes.map((e) => EMPLOYMENT_LABEL[e]).join("/"));
  if (t.minServiceMonths) parts.push(`after ${t.minServiceMonths} mo.`);
  return parts.join(" · ") || "All employees";
}

export function LeaveTypesClient({ types, canEdit }: { types: LeaveTypeRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<LeaveTypeRow, "id">>(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function start(t: LeaveTypeRow | null) {
    setForm(t ? { ...t } : blank);
    setEditing(t ? t.id : "new");
    setError(null);
  }

  async function save() {
    setBusy(true); setError(null);
    const res = await fetch(editing === "new" ? "/api/payroll/leave-types" : `/api/payroll/leave-types/${editing}`, {
      method: editing === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form, days: Number(form.days) || 0, maxCarryOver: Number(form.maxCarryOver) || 0, minServiceMonths: Number(form.minServiceMonths) || 0,
        soloParentExtraDays: Number(form.soloParentExtraDays) || 0,
        maxFilings: form.maxFilings === null || String(form.maxFilings) === "" ? null : Number(form.maxFilings),
        maxDaysPerYear: form.maxDaysPerYear === null || String(form.maxDaysPerYear) === "" ? null : Number(form.maxDaysPerYear),
      }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(d.error ?? "Could not save."); }
    setEditing(null); router.refresh();
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm({ ...form, [k]: v });
  const toggleEmployment = (e: EmploymentType) =>
    set("employmentTypes", form.employmentTypes.includes(e) ? form.employmentTypes.filter((x) => x !== e) : [...form.employmentTypes, e]);

  // Called as a function so inputs keep focus between keystrokes.
  function renderEditor() {
    return (
      <div className="my-2 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className={label}>Code<input value={form.code} onChange={(e) => set("code", e.target.value)} className={`${field} font-mono`} placeholder="BL" /></label>
          <label className={`${label} sm:col-span-2`}>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} className={field} placeholder="Birthday leave" /></label>
          <label className={label}>Legal basis<input value={form.legalBasis} onChange={(e) => set("legalBasis", e.target.value)} className={field} placeholder="Company policy" /></label>

          <label className={label}>Credits<select value={form.creditBasis} onChange={(e) => set("creditBasis", e.target.value as LeaveCreditBasis)} className={field}>
            {(Object.keys(CREDIT_BASIS_LABEL) as LeaveCreditBasis[]).map((b) => <option key={b} value={b}>{CREDIT_BASIS_LABEL[b]}</option>)}
          </select></label>
          {form.creditBasis !== "UNLIMITED" && (
            <label className={label}>{form.creditBasis === "ANNUAL" ? "Days per year" : "Max days per filing"}<input value={String(form.days)} inputMode="decimal" onChange={(e) => set("days", e.target.value as unknown as number)} className={`${field} text-right font-mono`} /></label>
          )}
          {form.creditBasis === "ANNUAL" && <>
            <label className={label}>Credits available<select value={form.accrual} onChange={(e) => set("accrual", e.target.value as LeaveAccrual)} className={field}>
              <option value="UPFRONT">All from January</option><option value="MONTHLY">Earned monthly (1/12)</option>
            </select></label>
            <label className={label}>Max carry-over to next year<input value={String(form.maxCarryOver)} inputMode="decimal" onChange={(e) => set("maxCarryOver", e.target.value as unknown as number)} className={`${field} text-right font-mono`} /></label>
          </>}

          {form.creditBasis === "PER_EVENT" && <>
            <label className={label}>Extra days for solo parents<input value={String(form.soloParentExtraDays)} inputMode="decimal" onChange={(e) => set("soloParentExtraDays", e.target.value as unknown as number)} className={`${field} text-right font-mono`} /></label>
            <label className={label}>Max days per year <span className="text-neutral-400">(blank = none)</span><input value={form.maxDaysPerYear == null ? "" : String(form.maxDaysPerYear)} inputMode="decimal" onChange={(e) => set("maxDaysPerYear", (e.target.value === "" ? null : e.target.value) as unknown as number | null)} className={`${field} text-right font-mono`} /></label>
            <label className={label}>Max filings ever <span className="text-neutral-400">(blank = none)</span><input value={form.maxFilings == null ? "" : String(form.maxFilings)} inputMode="numeric" onChange={(e) => set("maxFilings", (e.target.value === "" ? null : e.target.value) as unknown as number | null)} className={`${field} text-right font-mono`} /></label>
            <span />
          </>}
          <label className={label}>For<select value={form.eligibility} onChange={(e) => set("eligibility", e.target.value as LeaveEligibility)} className={field}>
            <option value="ANY">All employees</option><option value="FEMALE">Female employees</option><option value="MALE">Male employees</option>
          </select></label>
          <label className={label}>Months of service required<input value={String(form.minServiceMonths)} inputMode="numeric" onChange={(e) => set("minServiceMonths", e.target.value as unknown as number)} className={`${field} text-right font-mono`} /></label>
          <div className="sm:col-span-2">
            <span className={label}>Employment types <span className="text-neutral-400">(none ticked = all)</span></span>
            <div className="mt-1 flex flex-wrap gap-3">
              {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((e) => (
                <label key={e} className={check}><input type="checkbox" checked={form.employmentTypes.includes(e)} onChange={() => toggleEmployment(e)} /> {EMPLOYMENT_LABEL[e]}</label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className={check}><input type="checkbox" checked={form.isPaid} onChange={(e) => set("isPaid", e.target.checked)} /> With pay</label>
          <label className={check}><input type="checkbox" checked={form.countCalendarDays} onChange={(e) => set("countCalendarDays", e.target.checked)} /> Count calendar days (include rest days)</label>
          <label className={check}><input type="checkbox" checked={form.allowHalfDay} onChange={(e) => set("allowHalfDay", e.target.checked)} /> Allow half-day filing</label>
          <label className={check}><input type="checkbox" checked={form.soloParentOnly} onChange={(e) => set("soloParentOnly", e.target.checked)} /> Solo parents only</label>
          <label className={check}><input type="checkbox" checked={form.convertibleToCash} onChange={(e) => set("convertibleToCash", e.target.checked)} /> Unused days convertible to cash</label>
          <label className={check}><input type="checkbox" checked={form.allowNegative} onChange={(e) => set("allowNegative", e.target.checked)} /> Allow filing beyond the balance</label>
          <label className={check}><input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>
        </div>
        <label className={`${label} mt-3`}>Description / policy notes<textarea value={form.description} rows={2} onChange={(e) => set("description", e.target.value)} className={field} /></label>

        <div className="mt-3 flex items-center gap-2">
          <button onClick={save} disabled={busy} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">Save</button>
          <button onClick={() => setEditing(null)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-800">Leave types ({types.length})</h2>
        {canEdit && editing !== "new" && <button onClick={() => start(null)} className="rounded border border-brand-blue px-3 py-1 text-sm text-brand-blue hover:bg-blue-50">+ Add leave type</button>}
      </div>
      {editing === "new" && renderEditor()}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Leave type</th><th className="py-2 pr-3">Pay</th>
              <th className="py-2 pr-3">Credits</th><th className="py-2 pr-3">Who</th><th className="py-2 pr-3">Basis</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {types.map((t) => editing === t.id ? (
              <tr key={t.id}><td colSpan={7}><div className="pt-2 text-sm font-medium">{t.name}</div>{renderEditor()}</td></tr>
            ) : (
              <tr key={t.id} className={`align-top ${t.isActive ? "" : "text-neutral-400"}`}>
                <td className="py-2 pr-3 font-mono text-xs">{t.code}</td>
                <td className="py-2 pr-3">
                  <div>{t.name}{!t.isActive && <span className="ml-1 text-[10px]">(inactive)</span>}</div>
                  {t.description && <div className="max-w-md text-[11px] text-neutral-500">{t.description}</div>}
                </td>
                <td className="py-2 pr-3 text-xs">{t.isPaid ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">With pay</span> : <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Without pay</span>}</td>
                <td className="py-2 pr-3 text-xs">{summary(t)}{t.convertibleToCash ? " · cash-convertible" : ""}{t.maxCarryOver ? ` · carry ${t.maxCarryOver}` : ""}</td>
                <td className="py-2 pr-3 text-xs">{who(t)}</td>
                <td className="py-2 pr-3 text-xs">{t.legalBasis || "Company policy"}{t.isStatutory && <span className="ml-1 rounded bg-blue-50 px-1 text-[10px] text-brand-blue">PH law</span>}</td>
                <td className="py-2 text-right">{canEdit && <button onClick={() => start(t)} className="rounded px-2 py-1 text-xs text-brand-blue hover:bg-blue-50">Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
