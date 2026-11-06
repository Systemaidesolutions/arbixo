import { NextResponse } from "next/server";
import { payrollAuth } from "@/lib/payroll/server";
import { timesheetFillForRun } from "@/lib/payroll/timesheetServer";

// What the timesheets give each employee of this run (not saved: the editor merges it, the user reviews and saves).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await timesheetFillForRun(auth.companyId, params.id);
  return NextResponse.json(r.error ? { error: r.error } : { fills: r.fills, noEntries: r.noEntries }, { status: r.status });
}
