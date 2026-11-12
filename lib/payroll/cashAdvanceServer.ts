// Cash advances (Payroll › Cash advances): an amount given to an employee and
// paid back by a fixed installment on each payroll run until the balance is 0.
//
// Each draft REGULAR run reserves one installment per active advance as a
// CashAdvanceDeduction (rebuilt on every recompute). Posting the run makes it
// final and marks fully deducted advances PAID; deleting the run (cascade) or
// cancelling it removes its deductions, which restores the balance.
import { prisma } from "@/lib/prisma";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const n = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export type CashAdvanceInput = {
  employeeId: string; date: string; amount: number; installment: number; startDate: string | null; reference: string | null; description: string | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  return s || null;
};

/** Validates a create/edit body. Returns an error message or the clean input. */
export function parseCashAdvance(raw: Record<string, unknown>): CashAdvanceInput | string {
  const employeeId = typeof raw.employeeId === "string" ? raw.employeeId : "";
  if (!employeeId) return "Choose an employee.";
  const date = String(raw.date ?? "");
  if (!ISO.test(date)) return "Enter the date the cash advance was given.";
  const amount = r2(Number(raw.amount));
  if (!Number.isFinite(amount) || amount <= 0) return "Enter the cash advance amount.";
  const installment = r2(Number(raw.installment));
  if (!Number.isFinite(installment) || installment <= 0) return "Enter the amount to deduct per payroll run.";
  if (installment > amount) return "The deduction per payroll run can't be more than the cash advance.";
  const startRaw = String(raw.startDate ?? "").trim();
  if (startRaw && !ISO.test(startRaw)) return "Enter a valid start date.";
  return { employeeId, date, amount, installment, startDate: startRaw || null, reference: text(raw.reference, 60), description: text(raw.description, 300) };
}

/** What each advance has had deducted: posted runs, and draft runs (reserved). */
export async function deductedByAdvance(companyId: string, advanceIds: string[]) {
  const rows = advanceIds.length
    ? await prisma.cashAdvanceDeduction.findMany({
        where: { companyId, cashAdvanceId: { in: advanceIds }, payrollRun: { status: { in: ["POSTED", "DRAFT"] } } },
        select: { cashAdvanceId: true, amount: true, payrollRun: { select: { status: true } } },
      })
    : [];
  const out = new Map<string, { posted: number; draft: number }>();
  for (const r of rows) {
    const cur = out.get(r.cashAdvanceId) ?? { posted: 0, draft: 0 };
    if (r.payrollRun.status === "POSTED") cur.posted += n(r.amount); else cur.draft += n(r.amount);
    out.set(r.cashAdvanceId, cur);
  }
  return out;
}

/**
 * Rebuilds a draft regular run's cash advance deductions for the employees in
 * it and returns the total per employee. One installment per active advance
 * (less if that's all that's left), from runs paid on/after its start date.
 */
export async function claimCashAdvancesForRun(companyId: string, runId: string, employeeIds: string[]): Promise<Map<string, number>> {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId }, select: { status: true, kind: true, payDate: true } });
  const totals = new Map<string, number>();
  if (!run || run.status !== "DRAFT" || run.kind !== "REGULAR") return totals;

  await prisma.cashAdvanceDeduction.deleteMany({ where: { companyId, payrollRunId: runId } });
  if (employeeIds.length === 0) return totals;
  const advances = await prisma.cashAdvance.findMany({
    where: {
      companyId, status: "ACTIVE", employeeId: { in: employeeIds },
      OR: [{ startDate: null }, { startDate: { lte: run.payDate } }],
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  if (advances.length === 0) return totals;
  const done = await deductedByAdvance(companyId, advances.map((a) => a.id));
  const data: { companyId: string; cashAdvanceId: string; payrollRunId: string; employeeId: string; amount: number }[] = [];
  for (const a of advances) {
    const d = done.get(a.id) ?? { posted: 0, draft: 0 };
    const left = r2(n(a.amount) - d.posted - d.draft); // other draft runs keep what they reserved
    const amt = r2(Math.min(n(a.installment), left));
    if (amt <= 0) continue;
    data.push({ companyId, cashAdvanceId: a.id, payrollRunId: runId, employeeId: a.employeeId, amount: amt });
    totals.set(a.employeeId, r2((totals.get(a.employeeId) ?? 0) + amt));
  }
  if (data.length) await prisma.cashAdvanceDeduction.createMany({ data });
  return totals;
}

/** After posting: advances whose posted deductions reach the amount become PAID. */
export async function settleRunCashAdvances(companyId: string, runId: string) {
  const ids = (await prisma.cashAdvanceDeduction.findMany({ where: { companyId, payrollRunId: runId }, select: { cashAdvanceId: true } })).map((d) => d.cashAdvanceId);
  if (ids.length === 0) return;
  const advances = await prisma.cashAdvance.findMany({ where: { companyId, id: { in: ids }, status: "ACTIVE" }, select: { id: true, amount: true } });
  const done = await deductedByAdvance(companyId, ids);
  const paid = advances.filter((a) => (done.get(a.id)?.posted ?? 0) >= n(a.amount) - 0.005).map((a) => a.id);
  if (paid.length) await prisma.cashAdvance.updateMany({ where: { id: { in: paid } }, data: { status: "PAID" } });
}

/** A cancelled run's deductions are removed; advances it finished go back to ACTIVE. */
export async function releaseRunCashAdvances(companyId: string, runId: string) {
  const ids = (await prisma.cashAdvanceDeduction.findMany({ where: { companyId, payrollRunId: runId }, select: { cashAdvanceId: true } })).map((d) => d.cashAdvanceId);
  await prisma.cashAdvanceDeduction.deleteMany({ where: { companyId, payrollRunId: runId } });
  if (ids.length) await prisma.cashAdvance.updateMany({ where: { companyId, id: { in: ids }, status: "PAID" }, data: { status: "ACTIVE" } });
}

/** Per employee in a run: each advance deducted, with the balance left after this run. For payslips. */
export async function runCashAdvanceDetails(companyId: string, runId: string) {
  const rows = await prisma.cashAdvanceDeduction.findMany({
    where: { companyId, payrollRunId: runId },
    include: { cashAdvance: { select: { id: true, amount: true, reference: true, date: true } } },
    orderBy: { createdAt: "asc" },
  });
  const ids = [...new Set(rows.map((r) => r.cashAdvanceId))];
  const posted = ids.length
    ? await prisma.cashAdvanceDeduction.findMany({
        where: { companyId, cashAdvanceId: { in: ids }, OR: [{ payrollRun: { status: "POSTED" } }, { payrollRunId: runId }] },
        select: { cashAdvanceId: true, amount: true },
      })
    : [];
  const paidSoFar = new Map<string, number>();
  for (const p of posted) paidSoFar.set(p.cashAdvanceId, (paidSoFar.get(p.cashAdvanceId) ?? 0) + n(p.amount));
  const out = new Map<string, { label: string; amount: number; balance: number }[]>();
  for (const r of rows) {
    const a = r.cashAdvance;
    const list = out.get(r.employeeId) ?? [];
    list.push({
      label: `Cash advance${a.reference ? ` ${a.reference}` : ""} (${isoDate(a.date)})`,
      amount: n(r.amount),
      balance: r2(Math.max(0, n(a.amount) - (paidSoFar.get(a.id) ?? 0))),
    });
    out.set(r.employeeId, list);
  }
  return out;
}
