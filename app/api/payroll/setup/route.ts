import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSetup, payrollAuth } from "@/lib/payroll/server";

const NUMBER_FIELDS = ["workDaysPerYear", "hoursPerDay", "otMultiplier", "restDayMultiplier", "specialHolidayMultiplier", "regularHolidayMultiplier", "nightDiffRate"] as const;
const ACCOUNT_FIELDS = [
  "salariesExpenseAccountId", "contributionsExpenseAccountId", "sssPayableAccountId", "philhealthPayableAccountId",
  "hdmfPayableAccountId", "withholdingTaxPayableAccountId", "otherDeductionsAccountId", "netPayAccountId",
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
  if (typeof body.payUnworkedRegularHoliday === "boolean") data.payUnworkedRegularHoliday = body.payUnworkedRegularHoliday;

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
