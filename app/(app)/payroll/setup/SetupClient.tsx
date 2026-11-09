"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FREQUENCY_LABEL, type ContributionTiming, type PayFrequency } from "@/lib/payroll/compute";

type Account = { id: string; code: string; title: string };
type Setup = {
  workDaysPerYear: number; hoursPerDay: number; otMultiplier: number; premiumOtMultiplier: number; restDayMultiplier: number;
  otRateBasis: "BASIC" | "EMPLOYEE_RATE"; otEmployeeRateUsesPremiums: boolean;
  specialHolidayMultiplier: number; specialRestDayMultiplier: number; doubleSpecialMultiplier: number; doubleSpecialRestDayMultiplier: number;
  regularHolidayMultiplier: number; regularHolidayRestDayMultiplier: number; doubleHolidayMultiplier: number; doubleHolidayRestDayMultiplier: number;
  nightDiffRate: number; payUnworkedRegularHoliday: boolean; holidayRequiresPriorPresence: boolean;
  monthlyIncludesRestDays: boolean; monthlyIncludesSpecialDays: boolean; benefitsExemptCap: number;
  restWeekdays: number[]; thirteenthMonthAccountId: string | null; reimbursementAccountId: string | null; leaveMonthlyAccrual: boolean;
  shiftStart: string; shiftEnd: string; breakMinutes: number; lateGraceMinutes: number; otMinimumMinutes: number; otRoundingMinutes: number;
  salariesExpenseAccountId: string | null; contributionsExpenseAccountId: string | null; sssPayableAccountId: string | null;
  philhealthPayableAccountId: string | null; hdmfPayableAccountId: string | null; withholdingTaxPayableAccountId: string | null;
  otherDeductionsAccountId: string | null; netPayAccountId: string | null;
};
type Group = { id: string; code: string; name: string; frequency: PayFrequency; weekStartDay: number; contributionTiming: ContributionTiming; deductSss: boolean; deductPhilhealth: boolean; deductHdmf: boolean; withholdTax: boolean; isActive: boolean };
type Item = { id: string; code: string; name: string; kind: "EARNING" | "DEDUCTION"; taxable: boolean; isOtherBenefit: boolean; accountId: string | null; isActive: boolean };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100";
const label = "block text-xs text-neutral-500";
const btn = "rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50";
const btnGhost = "rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50";

// Defaults are the minimum rates in the DOLE Handbook on Workers' Statutory Monetary Benefits (2024).
const RULE_FIELDS: { key: keyof Setup; label: string; hint: string }[] = [
  { key: "workDaysPerYear", label: "Salary factor (days per year)", hint: "365 = paid every day; 313 = 6-day week; 261 = 5-day week; 305/253 if special days aren't paid. Daily rate = monthly × 12 ÷ this." },
  { key: "hoursPerDay", label: "Hours per day", hint: "Hourly rate = daily rate ÷ this (normal hours: 8)." },
  { key: "otMultiplier", label: "OT, ordinary day", hint: "1.25 = 125% of the hourly rate." },
  { key: "premiumOtMultiplier", label: "OT, rest day / special day / holiday", hint: "1.30 = 130% of that day's hourly rate (e.g. holiday OT = 2 × 1.3)." },
  { key: "nightDiffRate", label: "Night shift differential", hint: "0.10 = +10% of the hour's rate, 10pm–6am." },
  { key: "restDayMultiplier", label: "Rest day worked", hint: "1.30 = 130% of the daily rate." },
  { key: "specialHolidayMultiplier", label: "Special day worked", hint: "1.30." },
  { key: "specialRestDayMultiplier", label: "Special day on rest day", hint: "1.50." },
  { key: "doubleSpecialMultiplier", label: "Double special day", hint: "1.50." },
  { key: "doubleSpecialRestDayMultiplier", label: "Double special day on rest day", hint: "1.95." },
  { key: "regularHolidayMultiplier", label: "Regular holiday worked", hint: "2.00." },
  { key: "regularHolidayRestDayMultiplier", label: "Regular holiday on rest day", hint: "2.60." },
  { key: "doubleHolidayMultiplier", label: "Double regular holiday", hint: "3.00 worked; 2.00 if unworked." },
  { key: "doubleHolidayRestDayMultiplier", label: "Double holiday on rest day", hint: "3.90." },
  { key: "benefitsExemptCap", label: "Tax-exempt 13th month + bonuses / year", hint: "₱90,000 under TRAIN; only the excess is taxed." },
];

const ACCOUNT_FIELDS: { key: keyof Setup; label: string }[] = [
  { key: "salariesExpenseAccountId", label: "Salaries & wages expense (Dr)" },
  { key: "contributionsExpenseAccountId", label: "Employer contributions expense (Dr)" },
  { key: "sssPayableAccountId", label: "SSS payable (Cr)" },
  { key: "philhealthPayableAccountId", label: "PhilHealth payable (Cr)" },
  { key: "hdmfPayableAccountId", label: "Pag-IBIG payable (Cr)" },
  { key: "withholdingTaxPayableAccountId", label: "Withholding tax on compensation payable (Cr)" },
  { key: "otherDeductionsAccountId", label: "Other deductions, default (Cr)" },
  { key: "netPayAccountId", label: "Net pay: salaries payable or cash (Cr)" },
];

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const d = await res.json().catch(() => ({}));
  return d.error ?? "Could not save.";
}

function AccountSelect({ accounts, value, onChange, disabled, placeholder = "Select account…" }: { accounts: Account[]; value: string | null; onChange: (v: string | null) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <select value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} className={field}>
      <option value="">{placeholder}</option>
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title}</option>)}
    </select>
  );
}

export function SetupClient({ setup, groups, items, accounts, canEdit }: { setup: Setup; groups: Group[]; items: Item[]; accounts: Account[]; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Setup>(setup);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [leaveMsg, setLeaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveSetup() {
    setBusy(true); setMsg(null);
    const err = await send("/api/payroll/setup", "PUT", form);
    setBusy(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "Saved." });
    if (!err) router.refresh();
  }

  return (
    <div className="space-y-6">
      <section id="leave-credits" className="rounded-lg border border-brand-blue/30 bg-blue-50/40 p-4">
        <h2 className="text-sm font-medium text-neutral-800">Leave credits</h2>
        <label className="mt-2 flex items-start gap-2 text-sm text-neutral-700">
          <input
            type="checkbox" className="mt-1" disabled={!canEdit || busy} checked={form.leaveMonthlyAccrual}
            onChange={async (e) => {
              const on = e.target.checked;
              setForm({ ...form, leaveMonthlyAccrual: on });
              setBusy(true);
              const err = await send("/api/payroll/setup", "PUT", { leaveMonthlyAccrual: on });
              setBusy(false);
              setLeaveMsg(err ? { ok: false, text: err } : { ok: true, text: on ? "Saved: leave credits are now earned monthly." : "Saved: leave credits are granted in full on Jan 1." });
              if (err) setForm((f) => ({ ...f, leaveMonthlyAccrual: !on })); else router.refresh();
            }}
          />
          <span>
            <b>Earn leave credits monthly</b> <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${form.leaveMonthlyAccrual ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>{form.leaveMonthlyAccrual ? "ON" : "OFF"}</span>
            <span className="block text-xs text-neutral-500">
              Yearly leave credits are granted 1/12 on the 1st of each month instead of all on Jan 1. Example: 12 days a year = 1 credit on Jan 1,
              2 on Feb 1, 3 on Mar 1 … 12 on Dec 1. Applies to every employee unless their own setting under Payroll › Employees says otherwise. Off by default.
            </span>
          </span>
        </label>
        {leaveMsg && <p className={`mt-2 text-xs ${leaveMsg.ok ? "text-green-700" : "text-red-600"}`}>{leaveMsg.text}</p>}
      </section>
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-800">Pay rules</h2>
        <p className="text-xs text-neutral-500">Defaults follow the Labor Code. Change them if company policy pays more.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RULE_FIELDS.map((f) => (
            <label key={f.key} className={label} title={f.hint}>
              {f.label}
              <input value={String(form[f.key] ?? "")} disabled={!canEdit} inputMode="decimal" onChange={(e) => setForm({ ...form, [f.key]: e.target.value as unknown as number })} className={field} />
              <span className="mt-0.5 block text-[11px] text-neutral-400">{f.hint}</span>
            </label>
          ))}
          <label className="flex items-start gap-2 pt-5 text-sm text-neutral-700">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={form.payUnworkedRegularHoliday} onChange={(e) => setForm({ ...form, payUnworkedRegularHoliday: e.target.checked })} />
            <span>Pay daily-rate employees for unworked regular holidays (100%)</span>
          </label>
          <label className="flex items-start gap-2 pt-5 text-sm text-neutral-700">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={form.holidayRequiresPriorPresence} onChange={(e) => setForm({ ...form, holidayRequiresPriorPresence: e.target.checked })} />
            <span>Holiday pay only if present or on paid leave the workday before</span>
          </label>
          <label className="flex items-start gap-2 pt-5 text-sm text-neutral-700">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={form.monthlyIncludesSpecialDays} onChange={(e) => setForm({ ...form, monthlyIncludesSpecialDays: e.target.checked })} />
            <span>Monthly salary already pays special days (factor 365/313/261)</span>
          </label>
          <label className="flex items-start gap-2 pt-5 text-sm text-neutral-700">
            <input type="checkbox" className="mt-1" disabled={!canEdit} checked={form.monthlyIncludesRestDays} onChange={(e) => setForm({ ...form, monthlyIncludesRestDays: e.target.checked })} />
            <span>Monthly salary already pays rest days (factor 365)</span>
          </label>
        </div>
        <div className="mt-5 rounded border border-neutral-200 bg-neutral-50 p-3">
          <span className="text-xs font-medium text-neutral-700">Overtime rate</span>
          <div className="mt-2 space-y-2 text-sm text-neutral-700">
            <label className="flex items-start gap-2">
              <input type="radio" name="otRateBasis" className="mt-1" disabled={!canEdit} checked={form.otRateBasis === "BASIC"} onChange={() => setForm({ ...form, otRateBasis: "BASIC" })} />
              <span>
                <b>Per hour, based on the basic salary</b> <span className="text-xs text-neutral-500">(default)</span>
                <span className="block text-xs text-neutral-500">OT hour = daily rate ÷ hours per day (monthly salary × 12 ÷ salary factor first), times the OT rates above.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="otRateBasis" className="mt-1" disabled={!canEdit} checked={form.otRateBasis === "EMPLOYEE_RATE"} onChange={() => setForm({ ...form, otRateBasis: "EMPLOYEE_RATE" })} />
              <span>
                <b>Per hour, using each employee&apos;s own OT rate</b>
                <span className="block text-xs text-neutral-500">Set the OT rate per hour on each employee in Payroll employees. Employees with no OT rate set use the basic-salary rate.</span>
              </span>
            </label>
            {form.otRateBasis === "EMPLOYEE_RATE" && (
              <label className="ml-6 flex items-start gap-2">
                <input type="checkbox" className="mt-1" disabled={!canEdit} checked={form.otEmployeeRateUsesPremiums} onChange={(e) => setForm({ ...form, otEmployeeRateUsesPremiums: e.target.checked })} />
                <span>
                  Apply the OT rates above to the employee&apos;s OT rate
                  <span className="block text-xs text-neutral-500">
                    On: OT hour = employee rate × 125% (or × the day&apos;s rate × 130% on rest days and holidays). Off: the employee rate is paid as is for every OT hour.
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>
        <div className="mt-4">
          <span className={label}>Rest days <span className="text-neutral-400">(skipped when counting leave days)</span></span>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-neutral-700">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <label key={d} className="flex items-center gap-1">
                <input type="checkbox" disabled={!canEdit} checked={form.restWeekdays.includes(i)}
                  onChange={(e) => setForm({ ...form, restWeekdays: e.target.checked ? [...form.restWeekdays, i] : form.restWeekdays.filter((x) => x !== i) })} />
                {d}
              </label>
            ))}
          </div>
        </div>

        <h2 className="mt-6 text-sm font-medium text-neutral-800">Work schedule (biometric import)</h2>
        <p className="text-xs text-neutral-500">Punches are compared with this shift to get late/undertime, overtime and night hours. An end time at or before the start is an overnight shift. Employees can have their own shift in Payroll employees.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <label className={label}>Shift start<input type="time" value={form.shiftStart} disabled={!canEdit} onChange={(e) => setForm({ ...form, shiftStart: e.target.value })} className={field} /></label>
          <label className={label}>Shift end<input type="time" value={form.shiftEnd} disabled={!canEdit} onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })} className={field} /></label>
          {([["breakMinutes", "Unpaid break (min)"], ["lateGraceMinutes", "Late grace (min)"], ["otMinimumMinutes", "Min. OT counted (min)"], ["otRoundingMinutes", "Round OT down to (min)"]] as const).map(([k, t]) => (
            <label key={k} className={label}>{t}<input value={String(form[k])} inputMode="numeric" disabled={!canEdit} onChange={(e) => setForm({ ...form, [k]: e.target.value as unknown as number })} className={field} /></label>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-medium text-neutral-800">Posting accounts</h2>
        <p className="text-xs text-neutral-500">A posted payroll run creates one General Journal entry using these accounts.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ACCOUNT_FIELDS.map((f) => (
            <label key={f.key} className={label}>
              {f.label}
              <AccountSelect accounts={accounts} disabled={!canEdit} value={form[f.key] as string | null} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            </label>
          ))}
          <label className={label}>
            13th-month pay expense (Dr)
            <AccountSelect accounts={accounts} disabled={!canEdit} value={form.thirteenthMonthAccountId} onChange={(v) => setForm({ ...form, thirteenthMonthAccountId: v })} placeholder="Same as salaries & wages" />
          </label>
          <label className={label}>
            Employee reimbursements (Dr)
            <AccountSelect accounts={accounts} disabled={!canEdit} value={form.reimbursementAccountId} onChange={(v) => setForm({ ...form, reimbursementAccountId: v })} placeholder="Needed once a run pays reimbursements" />
          </label>
        </div>
        {canEdit && (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={saveSetup} disabled={busy} className={btn}>Save setup</button>
            {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        )}
      </section>

      <PayGroups groups={groups} canEdit={canEdit} />
      <PayItems items={items} accounts={accounts} canEdit={canEdit} />
    </div>
  );
}

function PayGroups({ groups, canEdit }: { groups: Group[]; canEdit: boolean }) {
  const router = useRouter();
  const blank: Omit<Group, "id"> = { code: "", name: "", frequency: "SEMI_MONTHLY", weekStartDay: 1, contributionTiming: "EVERY_RUN", deductSss: true, deductPhilhealth: true, deductHdmf: true, withholdTax: true, isActive: true };
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const err = await send(editing === "new" ? "/api/payroll/pay-groups" : `/api/payroll/pay-groups/${editing}`, editing === "new" ? "POST" : "PATCH", form);
    if (err) return setError(err);
    setEditing(null); router.refresh();
  }

  const flags: ["deductSss" | "deductPhilhealth" | "deductHdmf" | "withholdTax", string][] = [["deductSss", "SSS"], ["deductPhilhealth", "PhilHealth"], ["deductHdmf", "Pag-IBIG"], ["withholdTax", "Withholding tax"]];
  const editor = (
    <div className="rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className={label}>Code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={`${field} font-mono`} placeholder="CON-WK" /></label>
        <label className={`${label} sm:col-span-2`}>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="Site contractuals" /></label>
        <label className={label}>Pay frequency<select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as PayFrequency })} className={field}>{Object.entries(FREQUENCY_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      </div>
      {form.frequency === "WEEKLY" && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className={label}>Pay week starts on
            <select value={form.weekStartDay} onChange={(e) => setForm({ ...form, weekStartDay: Number(e.target.value) })} className={field}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
        </div>
      )}
      {(form.frequency === "WEEKLY" || form.frequency === "SEMI_MONTHLY") && (
        <label className={`${label} mt-3 block sm:max-w-md`}>SSS / PhilHealth / Pag-IBIG are deducted
          <select value={form.contributionTiming} onChange={(e) => setForm({ ...form, contributionTiming: e.target.value as ContributionTiming })} className={field}>
            <option value="EVERY_RUN">Every run (the monthly amount split across the runs)</option>
            <option value="FIRST_RUN">First run of the month only (whole monthly amount)</option>
            <option value="LAST_RUN">Last run of the month only (whole monthly amount)</option>
          </select>
          <span className="mt-1 block text-[11px] text-neutral-400">
            {form.frequency === "WEEKLY"
              ? "The run is placed by its pay date: first run = pay date on the 1st-7th, last run = pay date in the last 7 days of the month."
              : "The run is placed by its pay date: first run = 1st-15th, last run = 16th onward."}
            {" "}The whole-month amount is worked out from that run&apos;s pay as a monthly equivalent.
          </span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-700">
        <span className="text-xs text-neutral-500">Deduct:</span>
        {flags.map(([k, t]) => (
          <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={form[k] as boolean} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {t}</label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} className={btn}>{editing === "new" ? "Add pay group" : "Save"}</button>
        <button onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-800">Pay groups</h2>
          <p className="text-xs text-neutral-500">Employees paid on the same schedule and statutory rules, e.g. daily-rate contractuals paid weekly.</p>
        </div>
        {canEdit && editing !== "new" && <button onClick={() => { setForm(blank); setEditing("new"); setError(null); }} className="rounded border border-brand-blue px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-blue-50">+ Add pay group</button>}
      </div>
      {editing === "new" && <div className="mt-3">{editor}</div>}
      <table className="mt-3 w-full text-sm">
        <thead><tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Frequency</th><th className="py-2 pr-3">Deductions</th><th className="py-2"></th></tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {groups.map((g) => editing === g.id ? (
            <tr key={g.id}><td colSpan={5} className="py-2">{editor}</td></tr>
          ) : (
            <tr key={g.id} className={g.isActive ? "" : "text-neutral-400"}>
              <td className="py-1.5 pr-3 font-mono text-xs">{g.code}</td>
              <td className="py-1.5 pr-3">{g.name}</td>
              <td className="py-1.5 pr-3 text-xs">{FREQUENCY_LABEL[g.frequency]}{g.frequency === "WEEKLY" && <span className="text-neutral-400"> · starts {WEEKDAYS[g.weekStartDay].slice(0, 3)}</span>}{g.contributionTiming !== "EVERY_RUN" && <span className="text-neutral-400"> · gov. contributions {g.contributionTiming === "FIRST_RUN" ? "1st" : "last"} run</span>}</td>
              <td className="py-1.5 pr-3 text-xs">{flags.filter(([k]) => g[k]).map(([, t]) => t).join(", ") || "None"}</td>
              <td className="py-1.5 text-right">{canEdit && <>
                <button onClick={() => { const { id: _id, ...rest } = g; setForm(rest); setEditing(g.id); setError(null); }} className="rounded px-2 py-1 text-xs text-brand-blue hover:bg-blue-50">Edit</button>
                <button onClick={async () => { await send(`/api/payroll/pay-groups/${g.id}`, "PATCH", { isActive: !g.isActive }); router.refresh(); }} className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">{g.isActive ? "Deactivate" : "Activate"}</button>
              </>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PayItems({ items, accounts, canEdit }: { items: Item[]; accounts: Account[]; canEdit: boolean }) {
  const router = useRouter();
  const blank: Omit<Item, "id"> = { code: "", name: "", kind: "EARNING", taxable: true, isOtherBenefit: false, accountId: null, isActive: true };
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const acctLabel = (id: string | null) => { const a = accounts.find((x) => x.id === id); return a ? `${a.code} ${a.title}` : "Default"; };

  async function save() {
    const err = await send(editing === "new" ? "/api/payroll/pay-items" : `/api/payroll/pay-items/${editing}`, editing === "new" ? "POST" : "PATCH", form);
    if (err) return setError(err);
    setEditing(null); router.refresh();
  }

  const editor = (
    <div className="rounded-lg border border-brand-blue/30 bg-blue-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className={label}>Code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={`${field} font-mono`} /></label>
        <label className={label}>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} /></label>
        <label className={label}>Type<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Item["kind"] })} className={field}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></select></label>
        <label className={label}>Account<AccountSelect accounts={accounts} value={form.accountId} onChange={(v) => setForm({ ...form, accountId: v })} placeholder="Use setup default" /></label>
      </div>
      {form.kind === "EARNING" && (
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-700">
          <label className="flex items-center gap-1.5" title="Counted in taxable compensation, SSS compensation and Pag-IBIG fund salary"><input type="checkbox" checked={form.taxable} disabled={form.isOtherBenefit} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} /> Taxable</label>
          <label className="flex items-center gap-1.5" title="Christmas bonus, productivity incentive, loyalty award… Tax-exempt together with 13th-month pay up to the yearly cap; not part of SSS/PhilHealth/Pag-IBIG"><input type="checkbox" checked={form.isOtherBenefit} onChange={(e) => setForm({ ...form, isOtherBenefit: e.target.checked })} /> Bonus / other benefit (shares the ₱90k exemption)</label>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} className={btn}>{editing === "new" ? "Add pay item" : "Save"}</button>
        <button onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-800">Earnings & deductions</h2>
          <p className="text-xs text-neutral-500">Allowances, commissions, loans and cash advances encoded on a run or set as recurring per employee.</p>
        </div>
        {canEdit && editing !== "new" && <button onClick={() => { setForm(blank); setEditing("new"); setError(null); }} className="rounded border border-brand-blue px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-blue-50">+ Add pay item</button>}
      </div>
      {editing === "new" && <div className="mt-3">{editor}</div>}
      <table className="mt-3 w-full text-sm">
        <thead><tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Account</th><th className="py-2"></th></tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {items.map((it) => editing === it.id ? (
            <tr key={it.id}><td colSpan={5} className="py-2">{editor}</td></tr>
          ) : (
            <tr key={it.id} className={it.isActive ? "" : "text-neutral-400"}>
              <td className="py-1.5 pr-3 font-mono text-xs">{it.code}</td>
              <td className="py-1.5 pr-3">{it.name}</td>
              <td className="py-1.5 pr-3 text-xs">{it.kind === "EARNING" ? `Earning${it.isOtherBenefit ? " (bonus/benefit)" : it.taxable ? "" : " (non-taxable)"}` : "Deduction"}</td>
              <td className="py-1.5 pr-3 text-xs">{acctLabel(it.accountId)}</td>
              <td className="py-1.5 text-right">{canEdit && <>
                <button onClick={() => { const { id: _id, ...rest } = it; setForm(rest); setEditing(it.id); setError(null); }} className="rounded px-2 py-1 text-xs text-brand-blue hover:bg-blue-50">Edit</button>
                <button onClick={async () => { await send(`/api/payroll/pay-items/${it.id}`, "PATCH", { isActive: !it.isActive }); router.refresh(); }} className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">{it.isActive ? "Deactivate" : "Activate"}</button>
              </>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
