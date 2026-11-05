import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { isoDate } from "@/lib/payroll/server";
import { ReimbursementsClient } from "./ReimbursementsClient";

export const dynamic = "force-dynamic";

const TABS = ["PENDING", "APPROVED", "PAID", "ALL"] as const;
type Tab = (typeof TABS)[number];

// Payroll › Reimbursements: employees file from the leave portal (with receipt
// photos); staff approve or reject, then mark approved ones paid.
export default async function ReimbursementsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Reimbursements</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : "PENDING";

  const [rows, counts] = await Promise.all([
    prisma.reimbursement.findMany({
      where: { companyId: company.id, ...(tab === "ALL" ? {} : { status: tab }) },
      include: {
        employee: { select: { code: true, lastName: true, firstName: true } },
        attachments: { select: { id: true, fileName: true, contentType: true } },
        payrollRun: { select: { id: true, runNo: true, status: true } },
      },
      orderBy: tab === "PENDING" ? [{ createdAt: "asc" }] : [{ updatedAt: "desc" }],
      take: 300,
    }),
    prisma.reimbursement.groupBy({ by: ["status"], where: { companyId: company.id }, _count: true, _sum: { amount: true } }),
  ]);
  const stat = (s: string) => counts.find((c) => c.status === s);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Reimbursements</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500">
        Expenses employees file from the <a href="/payroll/leave-portal" className="text-brand-blue hover:underline">employee portal</a>, with
        photos of their receipts. Approve or reject each one. Approved ones are added to the employee&apos;s next payroll run (net pay
        only, not taxed) and marked paid when that run is posted. You can also mark one paid by hand if you pay it outside payroll.
      </p>
      <ReimbursementsClient
        canEdit={Boolean(capability?.canPost)}
        tab={tab}
        summary={{
          PENDING: { count: stat("PENDING")?._count ?? 0, amount: Number(stat("PENDING")?._sum.amount ?? 0) },
          APPROVED: { count: stat("APPROVED")?._count ?? 0, amount: Number(stat("APPROVED")?._sum.amount ?? 0) },
          PAID: { count: stat("PAID")?._count ?? 0, amount: Number(stat("PAID")?._sum.amount ?? 0) },
        }}
        rows={rows.map((r) => ({
          id: r.id,
          employee: `${r.employee.lastName}, ${r.employee.firstName}`,
          employeeCode: r.employee.code,
          date: isoDate(r.expenseDate),
          filedAt: r.createdAt.toISOString(),
          category: r.category,
          description: r.description,
          amount: Number(r.amount),
          status: r.status,
          viaPortal: r.filedViaPortal,
          decisionNote: r.decisionNote,
          paidNote: r.paidNote,
          paidAt: r.paidAt ? r.paidAt.toISOString() : null,
          attachments: r.attachments,
          run: r.payrollRun ? { id: r.payrollRun.id, runNo: r.payrollRun.runNo, status: r.payrollRun.status } : null,
        }))}
      />
    </main>
  );
}
