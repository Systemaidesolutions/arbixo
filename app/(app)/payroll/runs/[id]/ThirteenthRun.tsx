"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/format";

type Line = { employeeId: string; code: string; name: string; basis: number; pay: number; exempt: number; taxable: number; tax: number; net: number };
type Run = { id: string; runNo: string; status: "DRAFT" | "POSTED" | "CANCELLED"; groupName: string; branch: string | null; year: number; payDate: string; cap: number };

const STATUS_BADGE = { DRAFT: "bg-amber-100 text-amber-700", POSTED: "bg-green-100 text-green-700", CANCELLED: "bg-neutral-100 text-neutral-500" };
const mdy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };

/**
 * 13th-month pay run (PD 851). Figures are computed on the server from posted
 * regular runs: 1/12 of basic salary earned in the year less 13th-month already
 * paid, tax only on the part above the yearly exemption cap.
 */
export function ThirteenthRun({ companyId, run, lines: initial, canEdit, canCancel }: { companyId: string; run: Run; lines: Line[]; canEdit: boolean; canCancel: boolean }) {
  const router = useRouter();
  const [lines, setLines] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error ?? "Something went wrong."); return false; }
    return true;
  }

  const total = lines.reduce((t, l) => ({ basis: t.basis + l.basis, pay: t.pay + l.pay, exempt: t.exempt + l.exempt, tax: t.tax + l.tax, net: t.net + l.net }), { basis: 0, pay: 0, exempt: 0, tax: 0, net: 0 });

  async function post() {
    if (!confirm(`Post ${run.runNo} to the General Journal? 13th-month pay ${formatPeso(total.pay)} for ${lines.length} employee(s).`)) return;
    if (await call(`/api/payroll/runs/${run.id}/post`, "POST")) router.refresh();
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
  async function removeEmployee(l: Line) {
    if (!confirm(`Remove ${l.name} from this run?`)) return;
    if (await call(`/api/payroll/runs/${run.id}`, "PATCH", { removeEmployeeIds: [l.employeeId] })) setLines((ls) => ls.filter((x) => x.employeeId !== l.employeeId));
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium text-neutral-900">13th-month pay {run.runNo}</h1>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[run.status]}`}>{run.status}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{run.groupName}{run.branch ? ` · ${run.branch}` : ""} · Year {run.year} · Pay date {mdy(run.payDate)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <>
            <button onClick={post} disabled={busy || lines.length === 0} className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight disabled:opacity-50">Post to GL</button>
            <button onClick={remove} disabled={busy} className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Delete draft</button>
          </>}
          {canCancel && <button onClick={cancelRun} disabled={busy} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Cancel run</button>}
          <a href={`/payroll/runs/${run.id}/payslips`} target="_blank" rel="noreferrer" className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Payslips</a>
          <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Print register</button>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm text-red-600 print:hidden">{msg}</p>}
      <p className="mt-3 max-w-4xl text-xs text-neutral-500 print:hidden">
        PD 851: 1/12 of the basic salary earned in {run.year} from posted payroll runs (basic pay and paid leave, less absences and lates; excluding
        overtime, premiums, night shift, holiday pay of daily-paid staff, allowances and leave conversions), less 13th-month already paid this year.
        Employees who left get it pro rata. Up to {formatPeso(run.cap)} a year of 13th-month pay and other bonuses is tax-exempt; only the excess is
        taxed. Not subject to SSS, PhilHealth or Pag-IBIG.{run.status === "DRAFT" ? " Figures refresh each time this page opens." : ""}
      </p>

      <section className="mt-4 rounded-lg border border-neutral-200 p-4 print:border-0 print:p-0">
        <div className="hidden print:block">
          <h1 className="text-base font-semibold">13th-Month Pay Register: {run.runNo}</h1>
          <p className="text-xs">{run.groupName}{run.branch ? ` · ${run.branch}` : ""} · Year {run.year} · Pay date {mdy(run.payDate)}</p>
        </div>
        {lines.length === 0 ? <p className="text-sm text-neutral-500">No eligible employees. Rank-and-file employees with posted pay this year are included automatically.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3 text-right">Basic salary earned</th>
                  <th className="py-2 pr-3 text-right">13th-month pay</th>
                  <th className="py-2 pr-3 text-right">Tax-exempt</th>
                  <th className="py-2 pr-3 text-right">Taxable excess</th>
                  <th className="py-2 pr-3 text-right">W/tax</th>
                  <th className="py-2 pr-3 text-right">Net</th>
                  <th className="py-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((l) => (
                  <tr key={l.employeeId}>
                    <td className="py-1.5 pr-3">{l.name}<span className="ml-1 text-[10px] text-neutral-400">{l.code}</span></td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatPeso(l.basis)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono font-medium">{formatPeso(l.pay)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatPeso(l.exempt)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatPeso(l.taxable)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatPeso(l.tax)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono font-semibold">{formatPeso(l.net)}</td>
                    <td className="py-1.5 text-right print:hidden">{canEdit && <button onClick={() => removeEmployee(l)} className="rounded px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50">×</button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 font-mono font-medium">
                  <td className="py-2 pr-3 font-sans text-xs uppercase text-neutral-500">Totals</td>
                  <td className="py-2 pr-3 text-right">{formatPeso(total.basis)}</td>
                  <td className="py-2 pr-3 text-right">{formatPeso(total.pay)}</td>
                  <td className="py-2 pr-3 text-right">{formatPeso(total.exempt)}</td>
                  <td className="py-2 pr-3 text-right">{formatPeso(total.pay - total.exempt)}</td>
                  <td className="py-2 pr-3 text-right">{formatPeso(total.tax)}</td>
                  <td className="py-2 pr-3 text-right">{formatPeso(total.net)}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
