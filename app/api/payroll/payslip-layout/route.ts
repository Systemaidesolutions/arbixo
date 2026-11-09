import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, payrollAuth } from "@/lib/payroll/server";
import { cleanOptions, isLayoutKind } from "@/lib/payroll/payslipLayout";

// Payroll › Setup › Payslip layout: { layout, options? }. Options are kept
// even while a preset is selected, so switching back to Custom restores them.
export async function PUT(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = ((await request.json().catch(() => null)) ?? {}) as { layout?: unknown; options?: unknown };
  if (!isLayoutKind(body.layout)) return NextResponse.json({ error: "Choose a payslip layout." }, { status: 400 });
  await getOrCreateSetup(auth.companyId);
  const setup = await prisma.payrollSetup.update({
    where: { companyId: auth.companyId },
    data: { payslipLayout: body.layout, ...(body.options !== undefined ? { payslipOptions: cleanOptions(body.options) } : {}) },
    select: { payslipLayout: true, payslipOptions: true },
  });
  return NextResponse.json({ setup });
}
