import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, payrollAuth } from "@/lib/payroll/server";

const NUMBER_FIELDS = [
  "workDaysPerYear", "hoursPerDay", "otMultiplier", "premiumOtMultiplier", "restDayMultiplier", "specialHolidayMultiplier", "specialRestDayMultiplier",
  "doubleSpecialMultiplier", "doubleSpecialRestDayMultiplier", "regularHolidayMultiplier", "regularHolidayRestDayMultiplier",
  "doubleHolidayMultiplier", "doubleHolidayRestDayMultiplier", "nightDiffRate", "benefitsExemptCap",
] as const;
const BOOLEAN_FIELDS = ["payUnworkedRegularHoliday", "holidayRequiresPriorPresence", "monthlyIncludesRestDays", "monthlyIncludesSpecialDays"] as const;
const ACCOUNT_FIELDS = [
  "salariesExpenseAccountId", "contributionsExpenseAccountId", "sssPayableAccountId", "philhealthPayableAccountId",
  "hdmfPayableAccountId", "withholdingTaxPayableAccountId", "otherDeductionsAccountId", "netPayAccountId", "thirteenthMonthAccountId",
] as const;

export async function PUT(request: NextRequest) {
  const auth = await payrollAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  await getOrCreateSetup(auth.companyId);

  const data: Record<string, unknown> = {};
  for (const f of NUMBER_FIELDS) {
    if (!(f in body)) continue;
    const v = Number(body[f]);
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: `Invalid value for ${f}.` }, { status: 400 });
    data[f] = f === "workDaysPerYear" ? Math.round(v) : v;
  }
  for (const f of BOOLEAN_FIELDS) if (typeof body[f] === "boolean") data[f] = body[f];
  for (const f of ["shiftStart", "shiftEnd"] as const) {
    if (!(f in body)) continue;
    const v = String(body[f] ?? "").trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return NextResponse.json({ error: "Shift times must be HH:mm (24-hour)." }, { status: 400 });
    data[f] = v;
  }
  for (const f of ["breakMinutes", "lateGraceMinutes", "otMinimumMinutes", "otRoundingMinutes"] as const) {
    if (!(f in body)) continue;
    const v = Math.round(Number(body[f]));
    if (!Number.isFinite(v) || v < 0 || v > 600) return NextResponse.json({ error: `Invalid value for ${f}.` }, { status: 400 });
    data[f] = v;
  }
  if ("restWeekdays" in body) {
    const days = Array.isArray(body.restWeekdays) ? [...new Set((body.restWeekdays as unknown[]).map(Number))] : [];
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || days.length > 6) return NextResponse.json({ error: "Invalid rest days." }, { status: 400 });
    data.restWeekdays = days.sort();
  }

  const ids = ACCOUNT_FIELDS.map((f) => body[f]).filter((v): v is string => typeof v === "string" && !!v);
  const valid = new Set(
    (await prisma.account.findMany({ where: { companyId: auth.companyId, id: { in: ids }, accountType: "POSTING" }, select: { id: true } })).map((a) => a.id)
  );
  for (const f of ACCOUNT_FIELDS) {
    if (!(f in body)) continue;
    const v = body[f];
    if (v && (typeof v !== "string" || !valid.has(v))) return NextResponse.json({ error: "Choose a posting account from your chart of accounts." }, { status: 400 });
    data[f] = v || null;
  }

  const setup = await prisma.payrollSetup.update({ where: { companyId: auth.companyId }, data });
  return NextResponse.json({ setup });
}
