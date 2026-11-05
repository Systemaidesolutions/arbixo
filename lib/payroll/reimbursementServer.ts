import { prisma } from "@/lib/prisma";
import { parseReimbursement, todayPH, type ReimbursementInput } from "./reimbursement";

export type ReimbResult = { status: number; error?: string; id?: string };
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 500) : "") || null;

/** Files a reimbursement (always PENDING) for an employee of this company. */
export async function fileReimbursement(
  companyId: string,
  employeeId: string,
  userId: string | null,
  raw: ReimbursementInput,
  opts: { viaPortal?: boolean } = {}
): Promise<ReimbResult> {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId, isActive: true }, select: { id: true } });
  if (!emp) return { status: 404, error: "Employee not found." };
  const r = parseReimbursement(raw, todayPH());
  if (typeof r === "string") return { status: 400, error: r };
  const rec = await prisma.reimbursement.create({
    data: {
      companyId,
      employeeId,
      expenseDate: utc(r.expenseDate),
      category: r.category,
      description: r.description,
      amount: r.amount,
      filedViaPortal: !!opts.viaPortal,
      filedById: userId,
      attachments: { create: r.attachments },
    },
    select: { id: true },
  });
  return { status: 200, id: rec.id };
}

/** Staff decision: approve / reject a pending one, mark an approved one paid, or cancel. */
export async function decideReimbursement(companyId: string, userId: string, id: string, action: unknown, note: unknown): Promise<ReimbResult> {
  const rec = await prisma.reimbursement.findFirst({
    where: { id, companyId },
    select: { id: true, status: true, payrollRun: { select: { runNo: true, status: true } } },
  });
  if (!rec) return { status: 404, error: "Reimbursement not found." };
  if ((action === "paid" || action === "cancel") && rec.payrollRun?.status === "POSTED") {
    return { status: 400, error: `Already paid in payroll run ${rec.payrollRun.runNo}. Cancel that run to undo it.` };
  }
  const now = new Date();
  if (action === "approve" || action === "reject") {
    if (rec.status !== "PENDING") return { status: 400, error: "Only pending reimbursements can be approved or rejected." };
    await prisma.reimbursement.update({
      where: { id },
      data: { status: action === "approve" ? "APPROVED" : "REJECTED", decidedById: userId, decidedAt: now, decisionNote: clean(note) },
    });
    return { status: 200, id };
  }
  if (action === "paid") {
    if (rec.status !== "APPROVED") return { status: 400, error: "Only approved reimbursements can be marked paid." };
    await prisma.reimbursement.update({ where: { id }, data: { status: "PAID", paidById: userId, paidAt: now, paidNote: clean(note), payrollRunId: null } });
    return { status: 200, id };
  }
  if (action === "cancel") {
    if (rec.status !== "PENDING" && rec.status !== "APPROVED") return { status: 400, error: "This reimbursement is already closed." };
    await prisma.reimbursement.update({ where: { id }, data: { status: "CANCELLED", decidedById: userId, decidedAt: now, decisionNote: clean(note), payrollRunId: null } });
    return { status: 200, id };
  }
  return { status: 400, error: "Unknown action." };
}

/**
 * Reserves approved, not-yet-paid reimbursements of these employees for a
 * draft payroll run, and releases ones that no longer belong (employee
 * removed from the run, or the reimbursement was paid/cancelled by hand).
 * Returns the total per employee, added to their net pay.
 */
export async function claimReimbursementsForRun(companyId: string, runId: string, employeeIds: string[]): Promise<Map<string, number>> {
  await prisma.reimbursement.updateMany({
    where: { companyId, payrollRunId: runId, OR: [{ status: { not: "APPROVED" } }, { employeeId: { notIn: employeeIds } }] },
    data: { payrollRunId: null },
  });
  if (employeeIds.length) {
    await prisma.reimbursement.updateMany({
      where: { companyId, status: "APPROVED", payrollRunId: null, employeeId: { in: employeeIds } },
      data: { payrollRunId: runId },
    });
  }
  const rows = await prisma.reimbursement.groupBy({
    by: ["employeeId"],
    where: { companyId, payrollRunId: runId, status: "APPROVED" },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.employeeId, Math.round(Number(r._sum.amount ?? 0) * 100) / 100]));
}

/** Run posted: its reserved reimbursements become PAID. */
export async function markRunReimbursementsPaid(companyId: string, runId: string, runNo: string, userId: string) {
  await prisma.reimbursement.updateMany({
    where: { companyId, payrollRunId: runId, status: "APPROVED" },
    data: { status: "PAID", paidAt: new Date(), paidById: userId, paidNote: `Paid in payroll run ${runNo}` },
  });
}

/** Posted run cancelled: its reimbursements go back to APPROVED (unpaid) for the next run. */
export async function releaseRunReimbursements(companyId: string, runId: string) {
  await prisma.reimbursement.updateMany({
    where: { companyId, payrollRunId: runId, status: "PAID" },
    data: { status: "APPROVED", paidAt: null, paidById: null, paidNote: null, payrollRunId: null },
  });
  await prisma.reimbursement.updateMany({ where: { companyId, payrollRunId: runId }, data: { payrollRunId: null } });
}
