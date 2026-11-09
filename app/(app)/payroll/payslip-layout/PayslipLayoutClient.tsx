"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayslipView, type PayslipData } from "@/components/payroll/PayslipView";
import {
  LAYOUT_DESCRIPTION, LAYOUT_KINDS, LAYOUT_LABEL, PRESETS, resolvePayslipOptions,
  type PayslipLayoutKind, type PayslipOptions,
} from "@/lib/payroll/payslipLayout";

type Company = PayslipData["company"];

const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100";
const label = "block text-xs text-neutral-500";

const SECTIONS: [keyof PayslipOptions, string][] = [
  ["showLogo", "Company logo"],
  ["showAddress", "Company address"],
  ["showTin", "Company TIN"],
  ["showEmployeeCode", "Employee code"],
  ["showPosition", "Position"],
  ["showBranch", "Branch"],
  ["showAttendance", "Attendance (days, absences, late, OT, night hours)"],
  ["showEmployerShare", "Employer SSS / PhilHealth / Pag-IBIG share"],
  ["showLeaveTaken", "Leave taken this period"],
  ["showLeaveBalances", "Leave balances"],
];

function sample(company: Company): PayslipData {
  return {
    key: "sample",
    company,
    thirteenth: false,
    runNo: "PR-000123",
    period: "11/01/2026 – 11/15/2026",
    payDate: "11/15/2026",
    employee: { name: "Dela Cruz, Juan", code: "EMP0000001", position: "Site foreman", branch: "Main Branch" },
    earnings: [
      ["Basic pay (12 day/s × ₱800.00)", 9600],
      ["Rest day / special day / holiday premium", 240],
      ["Overtime", 1000],
      ["Night differential", 80],
      ["Late / undertime", -50],
      ["Meal allowance", 600],
    ],
    deductions: [["SSS", 500], ["PhilHealth", 287.5], ["Pag-IBIG", 100], ["Cash advance", 1000]],
    grossPay: 11470,
    totalDeductions: 1887.5,
    reimbursements: 350,
    netPay: 9932.5,
    attendance: { payBasis: "DAILY", daysWorked: 12, absentDays: 0, lateMinutes: 30, otHours: 8, nightHours: 4 },
    employer: { sss: 1030, philhealth: 287.5, hdmf: 100 },
    leave: {
      asOf: "11/15/2026",
      taken: [{ name: "Service Incentive Leave", paid: true, dates: ["2026-11-05"], days: 1 }],
      balances: [
        { code: "SIL", name: "Service Incentive Leave", earned: 5, used: 2, remaining: 3 },
        { code: "SL", name: "Sick Leave", earned: 5, used: 0, remaining: 5 },
      ],
    },
  };
}

export function PayslipLayoutClient({ canEdit, layout: savedLayout, custom: savedCustom, company }: {
  canEdit: boolean; layout: PayslipLayoutKind; custom: PayslipOptions | null; company: Company;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<PayslipLayoutKind>(savedLayout);
  const [custom, setCustom] = useState<PayslipOptions>(savedCustom ?? { ...PRESETS.STANDARD });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const options = layout === "CUSTOM" ? custom : resolvePayslipOptions(layout, null);
  const set = <K extends keyof PayslipOptions>(k: K, v: PayslipOptions[K]) => setCustom((c) => ({ ...c, [k]: v }));
  const locked = !canEdit || layout !== "CUSTOM";

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/payroll/payslip-layout", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout, options: custom }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setMsg({ ok: false, text: data.error ?? "Couldn't save." });
    setMsg({ ok: true, text: `Saved: payslips now print in the ${LAYOUT_LABEL[layout]} layout.` });
    router.refresh();
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-medium text-neutral-800">Layout</h2>
          <div className="mt-2 space-y-2">
            {LAYOUT_KINDS.map((k) => (
              <label key={k} className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${layout === k ? "border-brand-navy bg-blue-50/50" : "border-neutral-200"}`}>
                <input type="radio" name="layout" className="mt-1" disabled={!canEdit} checked={layout === k} onChange={() => setLayout(k)} />
                <span>
                  <b>{LAYOUT_LABEL[k]}</b>
                  {k === "STANDARD" && <span className="ml-1 text-xs text-neutral-500">(default)</span>}
                  {k === savedLayout && <span className="ml-1 rounded bg-green-100 px-1 text-[10px] font-medium text-green-700">In use</span>}
                  <span className="block text-xs text-neutral-500">{LAYOUT_DESCRIPTION[k]}</span>
                </span>
              </label>
            ))}
          </div>
          {canEdit && layout !== "CUSTOM" && (
            <button
              type="button"
              onClick={() => { setCustom({ ...resolvePayslipOptions(layout, null) }); setLayout("CUSTOM"); }}
              className="mt-3 text-xs text-brand-blue hover:underline"
            >
              Customize a copy of {LAYOUT_LABEL[layout]}
            </button>
          )}
        </section>

        <section className={`rounded-lg border border-neutral-200 p-4 ${layout === "CUSTOM" ? "" : "opacity-60"}`}>
          <h2 className="text-sm font-medium text-neutral-800">Custom layout</h2>
          {layout !== "CUSTOM" && <p className="text-xs text-neutral-500">Choose Custom to change these.</p>}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={`${label} col-span-2`}>Title<input value={custom.title} maxLength={40} disabled={locked} onChange={(e) => set("title", e.target.value)} className={field} /></label>
            <label className={label}>Payslips per page
              <select value={custom.perPage} disabled={locked} onChange={(e) => set("perPage", Number(e.target.value) as 1 | 2 | 3)} className={field}>
                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </select>
            </label>
            <label className={label}>Text size
              <select value={custom.fontSize} disabled={locked} onChange={(e) => set("fontSize", e.target.value as "small" | "normal")} className={field}>
                <option value="small">Small</option><option value="normal">Normal</option>
              </select>
            </label>
          </div>
          <div className="mt-3 space-y-1.5 text-sm text-neutral-700">
            <div className="text-xs font-medium text-neutral-600">Show</div>
            {SECTIONS.map(([k, t]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" disabled={locked} checked={custom[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} /> {t}
              </label>
            ))}
          </div>
          <div className="mt-3 space-y-2 text-sm text-neutral-700">
            <div className="text-xs font-medium text-neutral-600">Signatures</div>
            <label className="flex items-center gap-2"><input type="checkbox" disabled={locked} checked={custom.showSignature} onChange={(e) => set("showSignature", e.target.checked)} /> Employee signature line</label>
            {custom.showSignature && <input value={custom.signatureLabel} maxLength={40} disabled={locked} onChange={(e) => set("signatureLabel", e.target.value)} className={field} />}
            <label className="flex items-center gap-2"><input type="checkbox" disabled={locked} checked={custom.showPreparedBy} onChange={(e) => set("showPreparedBy", e.target.checked)} /> Prepared by / Approved by lines</label>
            {custom.showPreparedBy && (
              <div className="grid grid-cols-2 gap-2">
                <input value={custom.preparedByLabel} maxLength={40} disabled={locked} onChange={(e) => set("preparedByLabel", e.target.value)} className={field} />
                <input value={custom.approvedByLabel} maxLength={40} disabled={locked} onChange={(e) => set("approvedByLabel", e.target.value)} className={field} />
              </div>
            )}
          </div>
          <label className={`${label} mt-3`}>Footer note (optional)
            <textarea value={custom.footerNote} maxLength={300} rows={2} disabled={locked} placeholder="e.g. This payslip is confidential." onChange={(e) => set("footerNote", e.target.value)} className={field} />
          </label>
        </section>

        {canEdit && (
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy} className="rounded bg-brand-navy px-4 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">
              {busy ? "Saving…" : "Save layout"}
            </button>
            {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        )}
        {!canEdit && <p className="text-xs text-neutral-500">Only users who can post can change the payslip layout.</p>}
      </div>

      <div>
        <div className="mb-2 text-xs text-neutral-500">
          Preview: {LAYOUT_LABEL[layout]} · {options.perPage} per page{company.logoUrl || !options.showLogo ? "" : " · no logo uploaded in Company details"}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-4">
          <div className="mx-auto max-w-3xl bg-white p-4 shadow-sm">
            <PayslipView data={sample(company)} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}
