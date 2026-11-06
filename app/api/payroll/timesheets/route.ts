import { NextRequest, NextResponse } from "next/server";
import { payrollAuth } from "@/lib/payroll/server";
import { listTimesheet, saveTimesheet } from "@/lib/payroll/timesheetServer";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD[&employeeId=…] → the saved entries (and approved leave) in the range.
export async function GET(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const q = request.nextUrl.searchParams;
  const r = await listTimesheet(auth.companyId, q.get("from") ?? "", q.get("to") ?? "", q.get("employeeId"));
  return NextResponse.json(r.error ? { error: r.error } : { entries: r.entries, leaves: r.leaves }, { status: r.status });
}

// PUT { entries: [{ employeeId, date, status: PRESENT|ABSENT|NONE, timeIn, timeOut, days, lateMinutes, otHours, ndHours, ndOtHours, remarks }] }
export async function PUT(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) ?? {};
  const r = await saveTimesheet(auth.companyId, auth.userId, body.entries);
  return NextResponse.json(r.error ? { error: r.error } : { ok: true, saved: r.saved, cleared: r.cleared }, { status: r.status });
}
