import { notFound } from "next/navigation";
import { getCurrentCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { isoDate } from "@/lib/payroll/server";
import { PrintControls } from "@/components/PrintControls";

const mdy = (d: Date) => { const [y, m, dd] = isoDate(d).split("-"); return `${m}/${dd}/${y}`; };

// One payslip per employee, two per printed page.
export default async function PayslipsPage({ params, searchParams }: { params: { id: string }; searchParams: { employeeId?: string } }) {
  const company = await getCurrentCompany();
  if (!company) notFound();
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.id, companyId: company.id },
    include: { payGroup: true, lines: { where: searchParams.employeeId ? { employeeId: searchParams.employeeId } : {}, include: { employee: true } } },
  });
  if (!run) notFound();
  const items = await prisma.payItem.findMany({ where: { companyId: company.id } });
  const lines = [...run.lines].sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName));
  const n = (v: unknown) => Number(v);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-neutral-900 print:p-0">
      <PrintControls auto={false} />
      {run.status === "DRAFT" && <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 print:hidden">Draft run: figures can still change until the run is posted.</p>}
      {lines.map((l) => {
        const adj = (Array.isArray(l.adjustments) ? l.adjustments : []) as { payItemId: string; amount: number }[];
        const named = adj.flatMap((a) => { const it = items.find((i) => i.id === a.payItemId); return it ? [{ ...it, amount: Math.abs(Number(a.amount) || 0) }] : []; });
        const earnings: [string, number][] = [
          [l.payBasis === "DAILY" ? `Basic pay (${n(l.daysWorked)} day/s × ${formatPeso(n(l.rate))})` : `Basic pay${n(l.unpaidLeaveDays) ? ` (less ${n(l.unpaidLeaveDays)} day/s leave without pay)` : ""}`, n(l.basicPay)],
          ["Holiday pay (unworked regular holiday)", n(l.holidayPay)],
          [`Paid leave (${n(l.leaveDays)} day/s)`, n(l.leavePay)],
          ["Rest day / special day / holiday premium", n(l.premiumPay)],
          ["Overtime", n(l.otPay)],
          ["Night differential", n(l.nightDiffPay)],
          ["Late / undertime", -n(l.lateDeduction)],
          [`Unused leave converted to cash (${n(l.leaveConversionDays)} day/s)`, n(l.leaveConversionPay)],
          [`13th-month pay (1/12 of ${formatPeso(n(l.thirteenthMonthBasis))})`, n(l.thirteenthMonthPay)],
          ...named.filter((x) => x.kind === "EARNING").map((x) => [x.name, x.amount] as [string, number]),
        ];
        const deductions: [string, number][] = [
          ["SSS", n(l.sssEe)],
          ["PhilHealth", n(l.philhealthEe)],
          ["Pag-IBIG", n(l.hdmfEe)],
          ["Withholding tax", n(l.withholdingTax)],
          ...named.filter((x) => x.kind === "DEDUCTION").map((x) => [x.name, x.amount] as [string, number]),
        ];
        return (
          <section key={l.id} className="mb-6 break-inside-avoid border border-neutral-400 p-4 text-xs print:mb-4 [&:nth-of-type(2n)]:print:break-after-page">
            <div className="flex items-start justify-between border-b border-neutral-300 pb-2">
              <div>
                <div className="text-sm font-semibold">{company.registeredName || company.tradeName}</div>
                <div className="text-neutral-500">{company.businessAddress}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{run.kind === "THIRTEENTH_MONTH" ? "13TH-MONTH PAY SLIP" : "PAYSLIP"}</div>
                <div>{run.runNo}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
              <div>Employee: <b>{l.employee.lastName}, {l.employee.firstName}</b> ({l.employee.code})</div>
              <div>Period: <b>{run.kind === "THIRTEENTH_MONTH" ? `Year ${run.periodStart.getUTCFullYear()}` : `${mdy(run.periodStart)} – ${mdy(run.periodEnd)}`}</b></div>
              <div>Position: {l.employee.position ?? "—"}</div>
              <div>Pay date: <b>{mdy(run.payDate)}</b></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-6">
              <table className="w-full">
                <thead><tr className="border-b border-neutral-300 text-left"><th className="py-1">Earnings</th><th className="py-1 text-right">Amount</th></tr></thead>
                <tbody>{earnings.filter(([, v]) => v).map(([k, v]) => <tr key={k}><td className="py-0.5">{k}</td><td className="py-0.5 text-right font-mono">{formatPeso(v)}</td></tr>)}</tbody>
                <tfoot><tr className="border-t border-neutral-300 font-semibold"><td className="py-1">Gross pay</td><td className="py-1 text-right font-mono">{formatPeso(n(l.grossPay))}</td></tr></tfoot>
              </table>
              <table className="w-full">
                <thead><tr className="border-b border-neutral-300 text-left"><th className="py-1">Deductions</th><th className="py-1 text-right">Amount</th></tr></thead>
                <tbody>{deductions.filter(([, v]) => v).map(([k, v]) => <tr key={k}><td className="py-0.5">{k}</td><td className="py-0.5 text-right font-mono">{formatPeso(v)}</td></tr>)}</tbody>
                <tfoot><tr className="border-t border-neutral-300 font-semibold"><td className="py-1">Total deductions</td><td className="py-1 text-right font-mono">{formatPeso(n(l.totalDeductions))}</td></tr></tfoot>
              </table>
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-neutral-400 pt-2">
              <div className="text-sm">NET PAY: <b className="font-mono">{formatPeso(n(l.netPay))}</b></div>
              <div className="w-56 border-t border-neutral-500 pt-0.5 text-center text-neutral-500">Received by / date</div>
            </div>
          </section>
        );
      })}
      {lines.length === 0 && <p className="text-sm text-neutral-500">No employees in this run.</p>}
    </div>
  );
}
