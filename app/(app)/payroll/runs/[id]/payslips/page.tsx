import { notFound } from "next/navigation";
import { getCurrentCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { isoDate } from "@/lib/payroll/server";
import { PrintControls } from "@/components/PrintControls";
import { payslipLeave, type PayslipLeave } from "@/lib/payroll/leaveServer";
import { getOrCreateSetup } from "@/lib/payroll/server";
import { resolvePayslipOptions } from "@/lib/payroll/payslipLayout";
import { PayslipView, type PayslipData } from "@/components/payroll/PayslipView";

const mdy = (d: Date) => { const [y, m, dd] = isoDate(d).split("-"); return `${m}/${dd}/${y}`; };

// One payslip per employee, printed in the company's payslip layout
// (Payroll › Setup › Payslip layout; Standard = two per page).
export default async function PayslipsPage({ params, searchParams }: { params: { id: string }; searchParams: { employeeId?: string } }) {
  const company = await getCurrentCompany();
  if (!company) notFound();
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.id, companyId: company.id },
    include: { payGroup: true, lines: { where: searchParams.employeeId ? { employeeId: searchParams.employeeId } : {}, include: { employee: { include: { payrollProfile: { select: { locationId: true } } } } } } },
  });
  if (!run) notFound();
  const items = await prisma.payItem.findMany({ where: { companyId: company.id } });
  const lines = [...run.lines].sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName));
  const n = (v: unknown) => Number(v);
  const leave = run.kind === "THIRTEENTH_MONTH"
    ? new Map<string, PayslipLeave>()
    : await payslipLeave(company.id, lines.map((l) => l.employeeId), isoDate(run.periodStart), isoDate(run.periodEnd));
  const setup = await getOrCreateSetup(company.id);
  const options = resolvePayslipOptions(setup.payslipLayout, setup.payslipOptions);
  const locIds = [...new Set(lines.map((l) => l.employee.payrollProfile?.locationId).filter((v): v is string => !!v))];
  const branches = new Map((locIds.length ? await prisma.location.findMany({ where: { companyId: company.id, id: { in: locIds } }, select: { id: true, name: true } }) : []).map((b) => [b.id, b.name]));
  const thirteenth = run.kind === "THIRTEENTH_MONTH";

  const slips: PayslipData[] = lines.map((l) => {
    const adj = (Array.isArray(l.adjustments) ? l.adjustments : []) as { payItemId: string; amount: number }[];
    const named = adj.flatMap((a) => { const it = items.find((i) => i.id === a.payItemId); return it ? [{ ...it, amount: Math.abs(Number(a.amount) || 0) }] : []; });
    const lv = leave.get(l.employeeId);
    const loc = l.employee.payrollProfile?.locationId;
    return {
      key: l.id,
      company: { name: company.registeredName || company.tradeName, address: company.businessAddress, tin: company.tin, logoUrl: company.logoUrl },
      thirteenth,
      runNo: run.runNo,
      period: thirteenth ? `Year ${run.periodStart.getUTCFullYear()}` : `${mdy(run.periodStart)} – ${mdy(run.periodEnd)}`,
      payDate: mdy(run.payDate),
      employee: { name: `${l.employee.lastName}, ${l.employee.firstName}`, code: l.employee.code, position: l.employee.position, branch: loc ? branches.get(loc) ?? null : null },
      earnings: [
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
      ],
      deductions: [
        ["SSS", n(l.sssEe)],
        ["PhilHealth", n(l.philhealthEe)],
        ["Pag-IBIG", n(l.hdmfEe)],
        ["Withholding tax", n(l.withholdingTax)],
        ...named.filter((x) => x.kind === "DEDUCTION").map((x) => [x.name, x.amount] as [string, number]),
      ],
      grossPay: n(l.grossPay),
      totalDeductions: n(l.totalDeductions),
      reimbursements: n(l.reimbursements),
      netPay: n(l.netPay),
      attendance: thirteenth ? null : { payBasis: l.payBasis, daysWorked: n(l.daysWorked), absentDays: n(l.absentDays), lateMinutes: n(l.lateMinutes), otHours: n(l.otHours), nightHours: n(l.nightDiffHours) },
      employer: thirteenth ? null : { sss: n(l.sssEr), philhealth: n(l.philhealthEr), hdmf: n(l.hdmfEr) },
      leave: lv ? { asOf: mdy(run.periodEnd), taken: lv.taken, balances: lv.balances } : null,
    };
  });

  return (
    <div className={`mx-auto bg-white p-6 text-neutral-900 print:p-0 ${options.perPage === 1 ? "max-w-4xl" : "max-w-3xl"}`}>
      <PrintControls auto={false} />
      {run.status === "DRAFT" && <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 print:hidden">Draft run: figures can still change until the run is posted.</p>}
      {slips.map((p, i) => (
        <PayslipView key={p.key} data={p} options={options} pageBreakAfter={(i + 1) % options.perPage === 0 && i < slips.length - 1} />
      ))}
      {lines.length === 0 && <p className="text-sm text-neutral-500">No employees in this run.</p>}
    </div>
  );
}
