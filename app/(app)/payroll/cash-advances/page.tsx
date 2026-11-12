import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { isoDate } from "@/lib/payroll/server";
import { CashAdvancesClient } from "./CashAdvancesClient";

export const dynamic = "force-dynamic";

const TABS = ["ACTIVE", "PAID", "CANCELLED", "ALL"] as const;
type Tab = (typeof TABS)[number];

// Payroll › Cash advances: payroll staff record cash advances given to
// employees; each payroll run deducts the installment until the balance is 0.
export default async function CashAdvancesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Cash advances</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : "ACTIVE";
  const n = (v: unknown) => Number(v);

  const [rows, employees, active] = await Promise.all([
    prisma.cashAdvance.findMany({
      where: { companyId: company.id, ...(tab === "ALL" ? {} : { status: tab }) },
      include: {
        employee: { select: { code: true, lastName: true, firstName: true } },
        deductions: {
          where: { payrollRun: { status: { in: ["POSTED", "DRAFT"] } } },
          include: { payrollRun: { select: { id: true, runNo: true, status: true, payDate: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.employee.findMany({
      where: { companyId: company.id, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, code: true, lastName: true, firstName: true },
    }),
    prisma.cashAdvance.findMany({
      where: { companyId: company.id, status: "ACTIVE" },
      select: { amount: true, deductions: { where: { payrollRun: { status: "POSTED" } }, select: { amount: true } } },
    }),
  ]);
  const outstanding = active.reduce((s, a) => s + n(a.amount) - a.deductions.reduce((t, d) => t + n(d.amount), 0), 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Cash advances</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500">
        Record cash advances given to employees. Each payroll run deducts the installment you set, shown on the payslip with the
        balance left, until the advance is fully paid.
      </p>
      <CashAdvancesClient
        canEdit={Boolean(capability?.canPost)}
        tab={tab}
        outstanding={Math.round(outstanding * 100) / 100}
        activeCount={active.length}
        employees={employees.map((e) => ({ id: e.id, label: `${e.lastName}, ${e.firstName} (${e.code})` }))}
        rows={rows.map((r) => {
          const posted = r.deductions.filter((d) => d.payrollRun.status === "POSTED").reduce((s, d) => s + n(d.amount), 0);
          return {
            id: r.id,
            employeeId: r.employeeId,
            employee: `${r.employee.lastName}, ${r.employee.firstName}`,
            employeeCode: r.employee.code,
            date: isoDate(r.date),
            startDate: r.startDate ? isoDate(r.startDate) : "",
            reference: r.reference ?? "",
            description: r.description ?? "",
            amount: n(r.amount),
            installment: n(r.installment),
            deducted: Math.round(posted * 100) / 100,
            balance: Math.round((n(r.amount) - posted) * 100) / 100,
            status: r.status,
            note: r.note,
            history: r.deductions.map((d) => ({ runId: d.payrollRun.id, runNo: d.payrollRun.runNo, status: d.payrollRun.status, payDate: isoDate(d.payrollRun.payDate), amount: n(d.amount) })),
          };
        })}
      />
    </main>
  );
}
