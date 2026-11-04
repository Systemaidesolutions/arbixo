"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";

type EmploymentType = "REGULAR" | "PROBATIONARY" | "CONTRACTUAL" | "PROJECT_BASED" | "CASUAL";
type PayBasis = "MONTHLY" | "DAILY";
type Profile = {
  payGroupId: string | null; locationId: string | null; employmentType: EmploymentType; payBasis: PayBasis; rate: number;
  hireDate: string; contractEnd: string; sssNo: string; philhealthNo: string; pagibigNo: string; isMinimumWage: boolean;
  sex: "MALE" | "FEMALE" | null; isSoloParent: boolean; thirteenthMonthEligible: boolean;
  biometricId: string; shiftStart: string; shiftEnd: string;
  recurring: { payItemId: string; amount: number }[]; bankName: string; bankAccountNo: string; isActive: boolean;
};
type Employee = { id: string; code: string; name: string; position: string | null; isActive: boolean; profile: Profile | null };
type Option = { id: string; code?: string; name: string };
type PayItemOption = { id: string; code: string; name: string; kind: "EARNING" | "DEDUCTION" };

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  REGULAR: "Regular", PROBATIONARY: "Probationary", CONTRACTUAL: "Contractual", PROJECT_BASED: "Project-based", CASUAL: "Casual",
};
const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
const label = "block text-xs text-neutral-500";

const blankProfile = (): Profile => ({
  payGroupId: null, locationId: null, employmentType: "CONTRACTUAL", payBasis: "DAILY", rate: 0, hireDate: "", contractEnd: "",
  sssNo: "", philhealthNo: "", pagibigNo: "", isMinimumWage: false, sex: null, isSoloParent: false, thirteenthMonthEligible: true, biometricId: "", shiftStart: "", shiftEnd: "", recurring: [], bankName: "", bankAccountNo: "", isActive: true,
});

export function PayrollEmployeesClient({ employees, groups, items, branches, canEdit }: { employees: Employee[]; groups: Option[]; items: PayItemOption[]; branches: Option[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Profile>(blankProfile());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "setup" | "missing">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => employees.filter((e) => {
    if (filter === "setup" && !e.profile) return false;
    if (filter === "missing" && e.profile) return false;
    const s = q.trim().toLowerCase();
    return !s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s);
  }), [employees, filter, q]);

  function start(e: Employee) { setForm(e.profile ?? blankProfile()); setEditing(e.id); setError(null); }

  async function save() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/payroll/profiles/${editing}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, rate: Number(form.rate) || 0 }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(d.error ?? "Could not save."); }
    setEditing(null); router.refresh();
  }

  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? "—";

  // Called as a function (not <Editor />) so inputs keep focus between keystrokes.
  function renderEditor() {
    const setRec = (i: number, patch: Partial<{ payItemId: string; amount: number }>) =>
      setForm({ ...form, recurring: form.recurring.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
    return (
      <div className="my-2 rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className={label}>Employment type<select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })} className={field}>{Object.entries(EMPLOYMENT_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
          <label className={label}>Pay basis<select value={form.payBasis} onChange={(e) => setForm({ ...form, payBasis: e.target.value as PayBasis })} className={field}><option value="DAILY">Daily rate</option><option value="MONTHLY">Monthly salary</option></select></label>
          <label className={label}>{form.payBasis === "DAILY" ? "Daily rate" : "Monthly salary"}<input value={String(form.rate)} inputMode="decimal" onChange={(e) => setForm({ ...form, rate: e.target.value as unknown as number })} className={`${field} text-right font-mono`} /></label>
          <label className={label}>Pay group<select value={form.payGroupId ?? ""} onChange={(e) => setForm({ ...form, payGroupId: e.target.value || null })} className={field}><option value="">Select…</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className={label}>Branch<select value={form.locationId ?? ""} onChange={(e) => setForm({ ...form, locationId: e.target.value || null })} className={field}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className={label}>Hire / start date<input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className={field} /></label>
          <label className={label}>Contract end<input type="date" value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} className={field} /></label>
          <label className="flex items-center gap-2 pt-5 text-sm text-neutral-700"><input type="checkbox" checked={form.isMinimumWage} onChange={(e) => setForm({ ...form, isMinimumWage: e.target.checked })} /> Minimum wage earner (MWE)</label>
          <label className={label}>SSS no.<input value={form.sssNo} onChange={(e) => setForm({ ...form, sssNo: e.target.value })} className={field} /></label>
          <label className={label}>PhilHealth no.<input value={form.philhealthNo} onChange={(e) => setForm({ ...form, philhealthNo: e.target.value })} className={field} /></label>
          <label className={label}>Pag-IBIG no.<input value={form.pagibigNo} onChange={(e) => setForm({ ...form, pagibigNo: e.target.value })} className={field} /></label>
          <label className={label} title="Used for leave eligibility (maternity, paternity, VAWC…)">Sex<select value={form.sex ?? ""} onChange={(e) => setForm({ ...form, sex: (e.target.value || null) as Profile["sex"] })} className={field}><option value="">—</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></label>
          <label className="flex items-center gap-2 pt-5 text-sm text-neutral-700"><input type="checkbox" checked={form.isSoloParent} onChange={(e) => setForm({ ...form, isSoloParent: e.target.checked })} /> Solo parent (has Solo Parent ID)</label>
          <label className="flex items-center gap-2 pt-5 text-sm text-neutral-700" title="PD 851: rank-and-file employees get 13th-month pay; managerial employees don't"><input type="checkbox" checked={form.thirteenthMonthEligible} onChange={(e) => setForm({ ...form, thirteenthMonthEligible: e.target.checked })} /> Gets 13th-month pay (rank-and-file)</label>
          <span />
          <label className={label} title="The user ID enrolled on the biometric device. Blank = match by employee code.">Biometric ID<input value={form.biometricId} onChange={(e) => setForm({ ...form, biometricId: e.target.value })} className={field} placeholder="Same as code" /></label>
          <label className={label} title="Leave blank to use the company shift in Payroll setup">Own shift start<input type="time" value={form.shiftStart} onChange={(e) => setForm({ ...form, shiftStart: e.target.value })} className={field} /></label>
          <label className={label}>Own shift end<input type="time" value={form.shiftEnd} onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })} className={field} /></label>
          <span />
          <label className={label}>Bank<input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className={field} /></label>
          <label className={label}>Bank account no.<input value={form.bankAccountNo} onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })} className={field} /></label>
          <label className="flex items-center gap-2 pt-5 text-sm text-neutral-700"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Include in payroll</label>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-neutral-600">Recurring earnings & deductions <span className="font-normal text-neutral-400">(copied into every new run)</span></div>
          {form.recurring.map((r, i) => (
            <div key={i} className="mt-1 flex items-center gap-2">
              <select value={r.payItemId} onChange={(e) => setRec(i, { payItemId: e.target.value })} className="w-64 rounded border border-neutral-300 px-2 py-1 text-sm">
                <option value="">Select item…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.kind === "EARNING" ? "+" : "−"} {it.name}</option>)}
              </select>
              <input value={String(r.amount)} inputMode="decimal" onChange={(e) => setRec(i, { amount: e.target.value as unknown as number })} className="w-28 rounded border border-neutral-300 px-2 py-1 text-right font-mono text-sm" />
              <button onClick={() => setForm({ ...form, recurring: form.recurring.filter((_, j) => j !== i) })} className="text-xs text-red-600 hover:underline">Remove</button>
            </div>
          ))}
          <button onClick={() => setForm({ ...form, recurring: [...form.recurring, { payItemId: "", amount: 0 }] })} className="mt-1 text-xs text-brand-blue hover:underline">+ Add recurring item</button>
        </div>

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-800">Employees ({rows.length})</h2>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded border border-neutral-300 px-2 py-1 text-sm">
            <option value="all">All</option><option value="setup">With payroll profile</option><option value="missing">No payroll profile</option>
          </select>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Pay group</th>
              <th className="py-2 pr-3 text-right">Rate</th><th className="py-2 pr-3">Status</th><th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 && <tr><td colSpan={7} className="py-3 text-neutral-400">No employees.</td></tr>}
            {rows.map((e) => editing === e.id ? (
              <tr key={e.id}><td colSpan={7}><div className="pt-2 text-sm font-medium">{e.name}</div>{renderEditor()}</td></tr>
            ) : (
              <tr key={e.id} className={e.isActive ? "" : "text-neutral-400"}>
                <td className="py-1.5 pr-3 font-mono text-xs">{e.code}</td>
                <td className="py-1.5 pr-3">{e.name}{e.position && <span className="ml-1 text-xs text-neutral-400">· {e.position}</span>}</td>
                <td className="py-1.5 pr-3 text-xs">{e.profile ? EMPLOYMENT_LABEL[e.profile.employmentType] : "—"}</td>
                <td className="py-1.5 pr-3 text-xs">{e.profile ? groupName(e.profile.payGroupId) : "—"}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{e.profile ? `${formatPeso(e.profile.rate)}${e.profile.payBasis === "DAILY" ? "/day" : "/mo"}` : "—"}</td>
                <td className="py-1.5 pr-3">
                  {!e.profile ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Not set up</span>
                    : e.profile.isActive ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">In payroll</span>
                    : <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Excluded</span>}
                </td>
                <td className="py-1.5 text-right">{canEdit && <button onClick={() => start(e)} className="rounded px-2 py-1 text-xs text-brand-blue hover:bg-blue-50">{e.profile ? "Edit pay" : "Set up pay"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
