// One payslip, drawn from plain data + the company's layout options
// (lib/payroll/payslipLayout.ts). No hooks, so the payslip print page and the
// live preview on Setup › Payslip layout both use it.
import { formatPeso } from "@/lib/format";
import type { PayslipOptions } from "@/lib/payroll/payslipLayout";

export type PayslipData = {
  key: string;
  company: { name: string; address: string | null; tin: string | null; logoUrl: string | null };
  thirteenth: boolean;
  runNo: string;
  period: string;
  payDate: string;
  employee: { name: string; code: string; position: string | null; branch: string | null };
  earnings: [string, number][];
  deductions: [string, number][];
  grossPay: number;
  totalDeductions: number;
  reimbursements: number;
  netPay: number;
  attendance: { payBasis: "DAILY" | "MONTHLY"; daysWorked: number; absentDays: number; lateMinutes: number; otHours: number; nightHours: number } | null;
  employer: { sss: number; philhealth: number; hdmf: number } | null;
  leave: {
    asOf: string;
    taken: { name: string; paid: boolean; dates: string[]; days: number }[];
    balances: { code: string; name: string; earned: number; used: number; remaining: number }[];
  } | null;
};

const d2 = (v: number) => (Math.round(v * 100) / 100).toString();
const md = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;

function Amounts({ title, rows, totalLabel, total }: { title: string; rows: [string, number][]; totalLabel: string; total: number }) {
  return (
    <table className="w-full">
      <thead><tr className="border-b border-neutral-300 text-left"><th className="py-1">{title}</th><th className="py-1 text-right">Amount</th></tr></thead>
      <tbody>{rows.filter(([, v]) => v).map(([k, v]) => <tr key={k}><td className="py-0.5">{k}</td><td className="py-0.5 text-right font-mono">{formatPeso(v)}</td></tr>)}</tbody>
      <tfoot><tr className="border-t border-neutral-300 font-semibold"><td className="py-1">{totalLabel}</td><td className="py-1 text-right font-mono">{formatPeso(total)}</td></tr></tfoot>
    </table>
  );
}

export function PayslipView({ data: p, options: o, pageBreakAfter = false }: { data: PayslipData; options: PayslipOptions; pageBreakAfter?: boolean }) {
  const compact = o.perPage === 3;
  const text = o.fontSize === "normal" ? "text-sm" : "text-xs";
  const pad = compact ? "p-3" : "p-4";
  const gap = compact ? "mt-2" : "mt-3";
  const title = p.thirteenth ? `13TH-MONTH ${o.title}` : o.title;
  const att = o.showAttendance ? p.attendance : null;
  const er = o.showEmployerShare ? p.employer : null;
  const lv = p.leave && (o.showLeaveTaken || o.showLeaveBalances) && (p.leave.taken.length > 0 || p.leave.balances.length > 0) ? p.leave : null;

  return (
    <section
      className={`mb-6 break-inside-avoid border border-neutral-400 ${pad} ${text} print:mb-4`}
      style={pageBreakAfter ? { breakAfter: "page" } : undefined}
    >
      <div className="flex items-start justify-between gap-3 border-b border-neutral-300 pb-2">
        <div className="flex items-start gap-3">
          {o.showLogo && p.company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.company.logoUrl} alt="" className="h-10 w-auto max-w-[96px] object-contain" />
          )}
          <div>
            <div className="text-sm font-semibold">{p.company.name}</div>
            {o.showAddress && p.company.address && <div className="text-neutral-500">{p.company.address}</div>}
            {o.showTin && p.company.tin && <div className="text-neutral-500">TIN {p.company.tin}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{title}</div>
          <div>{p.runNo}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
        <div>Employee: <b>{p.employee.name}</b>{o.showEmployeeCode && <> ({p.employee.code})</>}</div>
        <div>Period: <b>{p.period}</b></div>
        {o.showPosition && <div>Position: {p.employee.position ?? "—"}</div>}
        <div>Pay date: <b>{p.payDate}</b></div>
        {o.showBranch && <div>Branch: {p.employee.branch ?? "—"}</div>}
      </div>

      {att && (
        <div className={`${gap} flex flex-wrap gap-x-5 gap-y-0.5 rounded bg-neutral-50 px-2 py-1 text-neutral-700 print:bg-transparent print:px-0`}>
          <span>Days worked: <b className="font-mono">{d2(att.daysWorked)}</b></span>
          {att.payBasis === "MONTHLY" && <span>Absent: <b className="font-mono">{d2(att.absentDays)}</b> day/s</span>}
          <span>Late / undertime: <b className="font-mono">{d2(att.lateMinutes)}</b> min</span>
          <span>OT: <b className="font-mono">{d2(att.otHours)}</b> hr/s</span>
          <span>Night: <b className="font-mono">{d2(att.nightHours)}</b> hr/s</span>
        </div>
      )}

      <div className={`${gap} grid grid-cols-2 gap-6`}>
        <Amounts title="Earnings" rows={p.earnings} totalLabel="Gross pay" total={p.grossPay} />
        <Amounts title="Deductions" rows={p.deductions} totalLabel="Total deductions" total={p.totalDeductions} />
      </div>

      {er && (er.sss || er.philhealth || er.hdmf) ? (
        <div className={`${gap} text-neutral-600`}>
          Employer share (not deducted from pay): SSS <span className="font-mono">{formatPeso(er.sss)}</span> · PhilHealth{" "}
          <span className="font-mono">{formatPeso(er.philhealth)}</span> · Pag-IBIG <span className="font-mono">{formatPeso(er.hdmf)}</span>
        </div>
      ) : null}

      {lv && (
        <div className={`${gap} grid grid-cols-2 gap-6 border-t border-neutral-300 pt-2`}>
          {o.showLeaveTaken && (
            <div>
              <div className="py-1 font-semibold">Leave this period</div>
              {lv.taken.length === 0 ? (
                <div className="text-neutral-500">No leave taken.</div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {lv.taken.map((t) => (
                      <tr key={`${t.name}${t.paid}`}>
                        <td className="py-0.5 align-top">{t.name}{t.paid ? "" : " (without pay)"}<div className="text-[10px] text-neutral-500">{t.dates.map(md).join(", ")}</div></td>
                        <td className="py-0.5 text-right align-top font-mono">{d2(t.days)} day/s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {o.showLeaveBalances && (
            <div>
              <div className="py-1 font-semibold">Leave balance as of {lv.asOf}</div>
              {lv.balances.length === 0 ? (
                <div className="text-neutral-500">No leave credits.</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-neutral-300 text-left text-neutral-500"><th className="py-0.5 font-normal">Type</th><th className="py-0.5 text-right font-normal">Earned</th><th className="py-0.5 text-right font-normal">Used</th><th className="py-0.5 text-right font-normal">Remaining</th></tr></thead>
                  <tbody>
                    {lv.balances.map((b) => (
                      <tr key={b.code}>
                        <td className="py-0.5">{b.name}</td>
                        <td className="py-0.5 text-right font-mono">{d2(b.earned)}</td>
                        <td className="py-0.5 text-right font-mono">{d2(b.used)}</td>
                        <td className={`py-0.5 text-right font-mono font-semibold ${b.remaining < 0 ? "text-red-600" : ""}`}>{d2(b.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`${gap} flex items-end justify-between gap-4 border-t border-neutral-400 pt-2`}>
        <div>
          {p.reimbursements > 0 && (
            <div className="text-neutral-600">Add: reimbursements (not taxed) <span className="font-mono">{formatPeso(p.reimbursements)}</span></div>
          )}
          <div className="text-sm">NET PAY: <b className="font-mono">{formatPeso(p.netPay)}</b></div>
        </div>
        {o.showSignature && <div className="w-56 border-t border-neutral-500 pt-0.5 text-center text-neutral-500">{o.signatureLabel || "Received by / date"}</div>}
      </div>

      {o.showPreparedBy && (
        <div className="mt-6 grid grid-cols-2 gap-10">
          <div className="border-t border-neutral-500 pt-0.5 text-center text-neutral-500">{o.preparedByLabel || "Prepared by"}</div>
          <div className="border-t border-neutral-500 pt-0.5 text-center text-neutral-500">{o.approvedByLabel || "Approved by"}</div>
        </div>
      )}

      {o.footerNote && <div className={`${gap} text-center text-[10px] text-neutral-500`}>{o.footerNote}</div>}
    </section>
  );
}
