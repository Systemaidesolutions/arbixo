import { prisma } from "@/lib/prisma";
import type { ContributionTiming, EmploymentType, PayBasis, PayFrequency, PayItemKind, Prisma, Sex } from "@prisma/client";

// Save handlers for the payroll master data: pay groups, pay items and the
// per-employee payroll profile. `id` null = create.

export type SaveResult = { status: number; error?: string; record?: unknown };
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
const isDup = (e: unknown) => (e as { code?: string }).code === "P2002";

const FREQUENCIES: PayFrequency[] = ["MONTHLY", "SEMI_MONTHLY", "WEEKLY", "DAILY"];
const TIMINGS: ContributionTiming[] = ["EVERY_RUN", "FIRST_RUN", "LAST_RUN"];
const KINDS: PayItemKind[] = ["EARNING", "DEDUCTION"];
const EMPLOYMENT: EmploymentType[] = ["REGULAR", "PROBATIONARY", "CONTRACTUAL", "PROJECT_BASED", "CASUAL"];
const BASES: PayBasis[] = ["MONTHLY", "DAILY"];

async function validAccount(companyId: string, id: unknown): Promise<boolean> {
  if (!id) return true;
  return (await prisma.account.count({ where: { companyId, id: String(id), accountType: "POSTING" } })) > 0;
}

export async function savePayGroup(companyId: string, id: string | null, raw: Record<string, unknown>): Promise<SaveResult> {
  const data: Prisma.PayGroupUncheckedUpdateInput = {};
  if ("code" in raw || !id) { const c = clean(raw.code); if (!c) return { status: 400, error: "Code is required." }; data.code = c.toUpperCase(); }
  if ("name" in raw || !id) { const nm = clean(raw.name); if (!nm) return { status: 400, error: "Name is required." }; data.name = nm; }
  if ("frequency" in raw) { if (!FREQUENCIES.includes(raw.frequency as PayFrequency)) return { status: 400, error: "Invalid frequency." }; data.frequency = raw.frequency as PayFrequency; }
  if ("weekStartDay" in raw) { const w = Number(raw.weekStartDay); if (!Number.isInteger(w) || w < 0 || w > 6) return { status: 400, error: "Week start must be a weekday." }; data.weekStartDay = w; }
  if ("contributionTiming" in raw) { if (!TIMINGS.includes(raw.contributionTiming as ContributionTiming)) return { status: 400, error: "Invalid contribution timing." }; data.contributionTiming = raw.contributionTiming as ContributionTiming; }
  for (const f of ["deductSss", "deductPhilhealth", "deductHdmf", "withholdTax", "isActive"] as const) if (typeof raw[f] === "boolean") data[f] = raw[f] as boolean;
  try {
    if (!id) return { status: 200, record: await prisma.payGroup.create({ data: { ...(data as Prisma.PayGroupUncheckedCreateInput), companyId } }) };
    if (!(await prisma.payGroup.findFirst({ where: { id, companyId } }))) return { status: 404, error: "Pay group not found." };
    return { status: 200, record: await prisma.payGroup.update({ where: { id }, data }) };
  } catch (e) {
    if (isDup(e)) return { status: 409, error: "A pay group with that code already exists." };
    throw e;
  }
}

export async function savePayItem(companyId: string, id: string | null, raw: Record<string, unknown>): Promise<SaveResult> {
  const data: Prisma.PayItemUncheckedUpdateInput = {};
  if ("code" in raw || !id) { const c = clean(raw.code); if (!c) return { status: 400, error: "Code is required." }; data.code = c.toUpperCase(); }
  if ("name" in raw || !id) { const nm = clean(raw.name); if (!nm) return { status: 400, error: "Name is required." }; data.name = nm; }
  if ("kind" in raw || !id) { if (!KINDS.includes(raw.kind as PayItemKind)) return { status: 400, error: "Choose Earning or Deduction." }; data.kind = raw.kind as PayItemKind; }
  if (typeof raw.taxable === "boolean") data.taxable = raw.taxable;
  if (typeof raw.isOtherBenefit === "boolean") data.isOtherBenefit = raw.isOtherBenefit;
  if (typeof raw.isActive === "boolean") data.isActive = raw.isActive;
  if ("accountId" in raw) {
    if (!(await validAccount(companyId, raw.accountId))) return { status: 400, error: "Choose a posting account." };
    data.accountId = clean(raw.accountId);
  }
  try {
    if (!id) return { status: 200, record: await prisma.payItem.create({ data: { ...(data as Prisma.PayItemUncheckedCreateInput), companyId } }) };
    if (!(await prisma.payItem.findFirst({ where: { id, companyId } }))) return { status: 404, error: "Pay item not found." };
    return { status: 200, record: await prisma.payItem.update({ where: { id }, data }) };
  } catch (e) {
    if (isDup(e)) return { status: 409, error: "A pay item with that code already exists." };
    throw e;
  }
}

export async function saveProfile(companyId: string, employeeId: string, raw: Record<string, unknown>): Promise<SaveResult> {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
  if (!emp) return { status: 404, error: "Employee not found." };

  if (!EMPLOYMENT.includes(raw.employmentType as EmploymentType)) return { status: 400, error: "Choose an employment type." };
  if (!BASES.includes(raw.payBasis as PayBasis)) return { status: 400, error: "Choose monthly or daily pay basis." };
  const rate = Number(raw.rate);
  if (!Number.isFinite(rate) || rate < 0) return { status: 400, error: "Enter a valid rate." };
  if (raw.payGroupId && !(await prisma.payGroup.count({ where: { id: String(raw.payGroupId), companyId } }))) return { status: 400, error: "Pay group not found." };
  if (raw.locationId && !(await prisma.location.count({ where: { id: String(raw.locationId), companyId } }))) return { status: 400, error: "Branch not found." };
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
  const recurring = Array.isArray(raw.recurring)
    ? (raw.recurring as { payItemId?: string; amount?: number }[]).filter((r) => r.payItemId && Number(r.amount)).map((r) => ({ payItemId: r.payItemId!, amount: Math.abs(Number(r.amount)) }))
    : [];

  const data = {
    payGroupId: clean(raw.payGroupId),
    locationId: clean(raw.locationId),
    employmentType: raw.employmentType as EmploymentType,
    payBasis: raw.payBasis as PayBasis,
    rate,
    hireDate: date(raw.hireDate),
    contractEnd: date(raw.contractEnd),
    sssNo: clean(raw.sssNo),
    philhealthNo: clean(raw.philhealthNo),
    pagibigNo: clean(raw.pagibigNo),
    isMinimumWage: raw.isMinimumWage === true,
    sex: raw.sex === "MALE" || raw.sex === "FEMALE" ? (raw.sex as Sex) : null,
    isSoloParent: raw.isSoloParent === true,
    thirteenthMonthEligible: raw.thirteenthMonthEligible !== false,
    biometricId: clean(raw.biometricId),
    shiftStart: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.shiftStart ?? "")) ? String(raw.shiftStart) : null,
    shiftEnd: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.shiftEnd ?? "")) ? String(raw.shiftEnd) : null,
    leaveMonthlyAccrual: raw.leaveMonthlyAccrual === true ? true : raw.leaveMonthlyAccrual === false ? false : null,
    restDayMode: raw.restDayMode === "FLEXIBLE" ? ("FLEXIBLE" as const) : ("FIXED" as const),
    restWeekdays: raw.restDayMode === "FLEXIBLE" || !Array.isArray(raw.restWeekdays)
      ? []
      : [...new Set((raw.restWeekdays as unknown[]).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
    recurring,
    bankName: clean(raw.bankName),
    bankAccountNo: clean(raw.bankAccountNo),
    isActive: raw.isActive !== false,
  };
  const record = await prisma.payrollProfile.upsert({
    where: { employeeId },
    create: { ...data, companyId, employeeId },
    update: data,
  });
  return { status: 200, record };
}
