import { prisma } from "@/lib/prisma";
import { validateEmployeeText } from "@/lib/partyValidation";
import { nextPartyCode } from "@/lib/numberSeriesServer";
import { pick, toAmount, toDateStr, type SheetRow } from "@/lib/transactionImportParse";
import { buildTemplate, toYesNo, type TemplateColumn } from "@/lib/xlsxTemplate";
import type { ImportIssue, ImportOutcome, ImportRow } from "@/lib/employeeImport";
import { saveProfile } from "./masters";

// Payroll employee import (Payroll › Employees). One row per employee, matched
// by Employee Code. An existing payroll profile is updated (blank cells keep
// the current value; recurring items are kept); otherwise a new profile is
// created. If the code isn't in Master Data yet and Last/First Name are given,
// the employee is created too.

const EMPLOYMENT: Record<string, string> = {
  regular: "REGULAR", probationary: "PROBATIONARY", contractual: "CONTRACTUAL", projectbased: "PROJECT_BASED", project: "PROJECT_BASED", casual: "CASUAL",
};
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const PROFILE_COLUMNS: TemplateColumn[] = [
  { header: "Employee Code", note: "Must match the code in Master Data › Employees.", required: true, text: true, width: 16 },
  { header: "Last Name", note: "Only needed to create an employee whose code isn't in Master Data yet.", width: 16 },
  { header: "First Name", note: "Only needed to create an employee whose code isn't in Master Data yet.", width: 16 },
  { header: "Employment Type", note: "Required for a new payroll profile.", choices: ["Regular", "Probationary", "Contractual", "Project-based", "Casual"], width: 16 },
  { header: "Pay Basis", note: "Daily rate or monthly salary. Required for a new payroll profile.", choices: ["Daily", "Monthly"] },
  { header: "Rate", note: "Daily rate or monthly salary in pesos. Required for a new payroll profile.", width: 12 },
  { header: "Pay Group", note: "Pay group code or name (Payroll › Setup).", width: 16 },
  { header: "Branch", note: "Branch name or branch code. Blank = none.", width: 16 },
  { header: "Hire Date", note: "YYYY-MM-DD or MM/DD/YYYY.", width: 12 },
  { header: "Contract End", note: "YYYY-MM-DD or MM/DD/YYYY.", width: 12 },
  { header: "SSS No", note: "", text: true, width: 14 },
  { header: "PhilHealth No", note: "", text: true, width: 15 },
  { header: "Pag-IBIG No", note: "", text: true, width: 15 },
  { header: "Minimum Wage", note: "Yes if a minimum wage earner (MWE).", choices: ["Yes", "No"] },
  { header: "Sex", note: "Used for leave eligibility.", choices: ["Female", "Male"] },
  { header: "Solo Parent", note: "Yes if holding a Solo Parent ID.", choices: ["Yes", "No"] },
  { header: "13th Month", note: "Yes for rank-and-file (gets 13th-month pay). Blank = Yes.", choices: ["Yes", "No"] },
  { header: "Biometric ID", note: "User ID on the biometric device. Blank = same as employee code.", text: true, width: 13 },
  { header: "Shift Start", note: "Own shift, 24-hour HH:mm, e.g. 08:00. Blank = company shift.", text: true },
  { header: "Shift End", note: "Own shift, 24-hour HH:mm, e.g. 17:00.", text: true },
  { header: "Rest Day Type", note: "Fixed = same days every week; Not fixed = set on every payroll run. Blank = Fixed.", choices: ["Fixed", "Not fixed"], width: 14 },
  { header: "Rest Days", note: "For Fixed: weekdays separated by commas, e.g. Sun or Sat,Sun. Blank = company rest days.", width: 12 },
  { header: "Monthly Leave Credits", note: "Yes = leave credits earned 1/12 on the 1st of each month; No = all on Jan 1; Company = follow Payroll setup. Blank keeps the current setting (Company for new).", choices: ["Company", "Yes", "No"], width: 16 },
  { header: "Bank", note: "", width: 14 },
  { header: "Bank Account No", note: "", text: true, width: 18 },
  { header: "Include in Payroll", note: "No to exclude from new runs. Blank = Yes.", choices: ["Yes", "No"], width: 16 },
];

export function profileTemplate() {
  return buildTemplate({
    sheetName: "Payroll Employees",
    title: "ARbixo payroll employee import",
    intro: [
      "Fill one row per employee on the Payroll Employees sheet, starting at row 2. Keep the header row as is.",
      "Delete the example rows before uploading. Save as .xlsx (or CSV).",
      "Employees are matched by Employee Code. For someone already set up, blank cells keep the current value.",
      "Recurring earnings/deductions aren't imported; set them per employee on the Payroll employees page.",
    ],
    columns: PROFILE_COLUMNS,
    examples: [
      ["EMP-0101", "", "", "Contractual", "Daily", "695", "WEEKLY", "", "2026-01-05", "2026-12-31", "34-1234567-8", "12-345678901-2", "1234-5678-9012", "Yes", "Male", "No", "Yes", "101", "", "", "Not fixed", "", "Company", "", "", "Yes"],
      ["EMP-0102", "Reyes", "Maria", "Regular", "Monthly", "25000", "SEMI", "Head Office", "2024-03-01", "", "", "", "", "No", "Female", "Yes", "Yes", "", "08:00", "17:00", "Fixed", "Sun", "Yes", "BDO", "001234567890", "Yes"],
    ],
  });
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

type Planned = { row: number; code: string; employeeId: string | null; newEmployee: { lastName: string; firstName: string } | null; raw: Record<string, unknown> };

export async function importProfiles(companyId: string, sheet: SheetRow[], dryRun: boolean): Promise<ImportOutcome> {
  const [employees, groups, branches] = await Promise.all([
    prisma.employee.findMany({ where: { companyId }, select: { id: true, code: true, lastName: true, firstName: true, payrollProfile: true } }),
    prisma.payGroup.findMany({ where: { companyId }, select: { id: true, code: true, name: true } }),
    prisma.location.findMany({ where: { companyId }, select: { id: true, name: true, branchCode: true } }),
  ]);
  const byCode = new Map(employees.map((e) => [e.code.toLowerCase(), e]));
  const findGroup = (s: string) => groups.find((g) => g.code.toLowerCase() === s.toLowerCase() || g.name.toLowerCase() === s.toLowerCase());
  const findBranch = (s: string) => branches.find((b) => b.name.toLowerCase() === s.toLowerCase() || (b.branchCode && b.branchCode === s));

  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  const plan: Planned[] = [];
  const seen = new Set<string>();

  sheet.forEach((r, i) => {
    const rowNo = i + 2;
    const get = (...h: string[]) => pick(r, h).trim();
    const code = get("Employee Code", "Code", "Emp No", "Employee No");
    if (!code && Object.values(r).every((v) => !v)) return;
    const emp = code ? byCode.get(code.toLowerCase()) : undefined;
    const lastName = get("Last Name"), firstName = get("First Name");
    const name = emp ? `${emp.lastName}, ${emp.firstName}` : `${lastName}, ${firstName}`.replace(/^, |, $/g, "");
    const fail = (message: string) => { issues.push({ row: rowNo, message }); rows.push({ row: rowNo, code, name, action: "skip", detail: message }); };

    if (!code) return fail("Employee Code is required.");
    if (seen.has(code.toLowerCase())) return fail(`Employee code ${code} appears more than once in the file.`);
    seen.add(code.toLowerCase());
    if (!emp && (!lastName || !firstName)) return fail(`No employee with code ${code}. Add Last Name and First Name to create one, or add them in Master Data first.`);
    if (!emp) { const t = validateEmployeeText({ lastName, firstName }); if (t) return fail(t); }

    // Start from the current profile so blank cells keep their value.
    const p = emp?.payrollProfile;
    const raw: Record<string, unknown> = p ? {
      payGroupId: p.payGroupId, locationId: p.locationId, employmentType: p.employmentType, payBasis: p.payBasis, rate: Number(p.rate),
      hireDate: iso(p.hireDate), contractEnd: iso(p.contractEnd), sssNo: p.sssNo, philhealthNo: p.philhealthNo, pagibigNo: p.pagibigNo,
      isMinimumWage: p.isMinimumWage, sex: p.sex, isSoloParent: p.isSoloParent, thirteenthMonthEligible: p.thirteenthMonthEligible,
      biometricId: p.biometricId, shiftStart: p.shiftStart, shiftEnd: p.shiftEnd, restDayMode: p.restDayMode, restWeekdays: p.restWeekdays, leaveMonthlyAccrual: p.leaveMonthlyAccrual,
      recurring: p.recurring ?? [], bankName: p.bankName, bankAccountNo: p.bankAccountNo, isActive: p.isActive,
    } : { thirteenthMonthEligible: true, isActive: true, restDayMode: "FIXED", restWeekdays: [] };

    const et = get("Employment Type");
    if (et) { const v = EMPLOYMENT[et.toLowerCase().replace(/[^a-z]/g, "")]; if (!v) return fail(`Unknown employment type: ${et}`); raw.employmentType = v; }
    const basis = get("Pay Basis");
    if (basis) { const b = basis.toLowerCase(); if (b.startsWith("d")) raw.payBasis = "DAILY"; else if (b.startsWith("m")) raw.payBasis = "MONTHLY"; else return fail(`Pay basis must be Daily or Monthly: ${basis}`); }
    const rate = get("Rate", "Daily Rate", "Monthly Salary");
    if (rate) { const n = toAmount(rate); if (n == null || n < 0) return fail(`Invalid rate: ${rate}`); raw.rate = n; }
    if (!raw.employmentType) return fail("Employment Type is required for a new payroll profile.");
    if (!raw.payBasis) return fail("Pay Basis is required for a new payroll profile.");
    if (raw.rate == null) return fail("Rate is required for a new payroll profile.");

    const grp = get("Pay Group");
    if (grp) { const g = findGroup(grp); if (!g) return fail(`Pay group not found: ${grp}`); raw.payGroupId = g.id; }
    const br = get("Branch", "Branch Code");
    if (br) { const b = findBranch(br); if (!b) return fail(`Branch not found: ${br}`); raw.locationId = b.id; }
    for (const [key, header] of [["hireDate", "Hire Date"], ["contractEnd", "Contract End"]] as const) {
      const v = get(header);
      if (v) { const d = toDateStr(v); if (!d) return fail(`Invalid ${header}: ${v}`); raw[key] = d; }
    }
    for (const [key, ...h] of [["sssNo", "SSS No", "SSS"], ["philhealthNo", "PhilHealth No", "PhilHealth"], ["pagibigNo", "Pag-IBIG No", "Pagibig No", "HDMF No"], ["biometricId", "Biometric ID"], ["bankName", "Bank"], ["bankAccountNo", "Bank Account No", "Account No"]] as const) {
      const v = get(...h); if (v) raw[key] = v;
    }
    for (const [key, header] of [["isMinimumWage", "Minimum Wage"], ["isSoloParent", "Solo Parent"], ["thirteenthMonthEligible", "13th Month"], ["isActive", "Include in Payroll"]] as const) {
      const v = get(header); if (!v) continue;
      const b = toYesNo(v); if (b === null) return fail(`${header} must be Yes or No: ${v}`); raw[key] = b;
    }
    const sex = get("Sex");
    if (sex) { const s = sex.toLowerCase(); if (s.startsWith("f")) raw.sex = "FEMALE"; else if (s.startsWith("m")) raw.sex = "MALE"; else return fail(`Sex must be Female or Male: ${sex}`); }
    for (const [key, header] of [["shiftStart", "Shift Start"], ["shiftEnd", "Shift End"]] as const) {
      const v = get(header); if (!v) continue;
      const m = v.match(/^(\d{1,2}):(\d{2})/);
      if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return fail(`${header} must be HH:mm (24-hour): ${v}`);
      raw[key] = `${m[1].padStart(2, "0")}:${m[2]}`;
    }
    if (!raw.shiftStart !== !raw.shiftEnd) return fail("Give both Shift Start and Shift End, or neither.");
    const mode = get("Rest Day Type");
    if (mode) { const m = mode.toLowerCase().replace(/[^a-z]/g, ""); if (m === "fixed") raw.restDayMode = "FIXED"; else if (["notfixed", "flexible", "rotating", "nonfixed"].includes(m)) raw.restDayMode = "FLEXIBLE"; else return fail(`Rest Day Type must be Fixed or Not fixed: ${mode}`); }
    const days = get("Rest Days", "Rest Day");
    if (days) {
      const parts = days.split(/[,/;& ]+/).filter(Boolean);
      const nums = parts.map((d) => WEEKDAYS.indexOf(d.toLowerCase().slice(0, 3)));
      if (nums.some((n) => n < 0)) return fail(`Rest Days must be weekday names like Sun or Sat,Sun: ${days}`);
      raw.restWeekdays = nums;
      if (!mode) raw.restDayMode = "FIXED";
    }

    const accr = get("Monthly Leave Credits", "Monthly Leave", "Leave Accrual");
    if (accr) {
      const a = accr.toLowerCase().replace(/[^a-z]/g, "");
      if (["company", "default", "companysetting"].includes(a)) raw.leaveMonthlyAccrual = null;
      else { const yn = toYesNo(accr); if (yn === null) return fail(`Monthly Leave Credits must be Company, Yes or No: ${accr}`); raw.leaveMonthlyAccrual = yn; }
    }

    plan.push({ row: rowNo, code, employeeId: emp?.id ?? null, newEmployee: emp ? null : { lastName, firstName }, raw });
    const what = [`${String(raw.payBasis) === "DAILY" ? "Daily" : "Monthly"} ${Number(raw.rate).toLocaleString("en-PH")}`, raw.restDayMode === "FLEXIBLE" ? "rest day not fixed" : ""].filter(Boolean).join(" · ");
    rows.push({ row: rowNo, code, name, action: p ? "update" : "create", detail: emp ? what : `New employee + payroll profile · ${what}` });
  });

  const outcome: ImportOutcome = { rows, issues, canImport: plan.length > 0, created: 0, updated: 0 };
  if (dryRun) return outcome;

  for (const p of plan) {
    const row = rows.find((x) => x.row === p.row);
    const skip = (message: string) => { issues.push({ row: p.row, message }); if (row) { row.action = "skip"; row.detail = message; } };
    try {
      let employeeId = p.employeeId;
      if (!employeeId && p.newEmployee) {
        const e = await prisma.employee.create({ data: { companyId, code: p.code || (await nextPartyCode(companyId, "employee")), ...p.newEmployee } });
        employeeId = e.id;
      }
      const r = await saveProfile(companyId, employeeId!, p.raw);
      if (r.error) { skip(r.error); continue; }
      if (row?.action === "update") outcome.updated++; else outcome.created++;
    } catch {
      skip("Could not save this row.");
    }
  }
  return outcome;
}
