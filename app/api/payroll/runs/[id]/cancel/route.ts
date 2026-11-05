import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payrollAuth } from "@/lib/payroll/server";
import { releaseRunReimbursements } from "@/lib/payroll/reimbursementServer";

// The GL side is reversed first through the shared /api/ledger-entries/cancel
// (General Journal, document no. = run no.); this then marks the run itself
// cancelled once that reversal exists.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await payrollAuth("canCancel");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const run = await prisma.payrollRun.findFirst({ where: { id: params.id, companyId: auth.companyId } });
  if (!run) return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });
  if (run.status !== "POSTED") return NextResponse.json({ error: "Only posted runs can be cancelled." }, { status: 400 });
  const live = await prisma.ledgerEntry.count({
    where: { companyId: auth.companyId, journalType: "GENERAL_JOURNAL", documentNo: run.runNo, isCancelled: false },
  });
  if (live > 0) return NextResponse.json({ error: "Reverse the journal entry first." }, { status: 400 });
  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "CANCELLED" } });
  // Reimbursements it paid go back to approved, for the next run.
  await releaseRunReimbursements(auth.companyId, run.id);
  return NextResponse.json({ ok: true });
}
