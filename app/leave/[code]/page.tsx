import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPortalEmployee } from "@/lib/leavePortal";
import { employeeBalances } from "@/lib/payroll/leaveServer";
import { getOrCreateSetup, isoDate } from "@/lib/payroll/server";
import { todayPH } from "@/lib/payroll/reimbursement";
import { LeavePortalClient } from "./LeavePortalClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leave & reimbursement · ARbixo", robots: { index: false, follow: false } };

// Employee leave portal. Public link per company (/leave/<code>); employees
// sign in with their employee number + PIN (no ARbixo account).
export default async function LeavePortalPage({ params }: { params: { code: string } }) {
  const company = await prisma.company.findUnique({
    where: { leavePortalCode: params.code },
    select: { id: true, tradeName: true, leavePortalEnabled: true },
  });

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </main>
  );

  if (!company || !company.leavePortalEnabled) {
    return shell(
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-[#0B2A5E]">Leave link not active</h1>
        <p className="mt-2 text-sm text-neutral-600">This link isn&apos;t active. Ask your HR or payroll staff for the current link.</p>
      </div>
    );
  }

  const emp = await getPortalEmployee();
  if (!emp || emp.companyId !== company.id) {
    return shell(<LeavePortalClient mode="signin" portal={params.code} companyName={company.tradeName} />);
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const [balances, types, requests, setup, profile, reimbs] = await Promise.all([
    employeeBalances(company.id, emp.id, year, now),
    prisma.leaveType.findMany({
      where: { companyId: company.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, allowHalfDay: true, isPaid: true },
    }),
    prisma.leaveRequest.findMany({
      where: { companyId: company.id, employeeId: emp.id, kind: "FILING", endDate: { gte: new Date(Date.UTC(year - 1, 0, 1)) } },
      include: { leaveType: { select: { code: true, name: true } } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    getOrCreateSetup(company.id),
    prisma.payrollProfile.findUnique({ where: { employeeId: emp.id }, select: { id: true } }),
    prisma.reimbursement.findMany({
      where: { companyId: company.id, employeeId: emp.id },
      select: {
        id: true, expenseDate: true, category: true, description: true, amount: true, status: true, decisionNote: true,
        attachments: { select: { id: true, fileName: true, contentType: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
  ]);

  return shell(
    <LeavePortalClient
      mode="home"
      portal={params.code}
      companyName={company.tradeName}
      employee={{ name: `${emp.firstName} ${emp.lastName}`, code: emp.code }}
      ready={!!profile}
      year={year}
      restWeekdays={setup.restWeekdays}
      balances={balances}
      types={types}
      requests={requests.map((r) => ({
        id: r.id,
        type: `${r.leaveType.code} · ${r.leaveType.name}`,
        start: isoDate(r.startDate),
        end: isoDate(r.endDate),
        days: Number(r.days),
        status: r.status,
        reason: r.reason,
        note: r.decisionNote,
      }))}
      today={todayPH(now)}
      reimbursements={reimbs.map((r) => ({
        id: r.id,
        date: isoDate(r.expenseDate),
        category: r.category,
        description: r.description,
        amount: Number(r.amount),
        status: r.status,
        note: r.decisionNote,
        attachments: r.attachments,
      }))}
    />
  );
}
