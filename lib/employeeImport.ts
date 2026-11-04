import { prisma } from "@/lib/prisma";
import { validateEmployeeText } from "@/lib/partyValidation";
import { nextPartyCode } from "@/lib/numberSeriesServer";
import { pick, type SheetRow } from "@/lib/transactionImportParse";
import { buildTemplate, toYesNo, type TemplateColumn } from "@/lib/xlsxTemplate";

// Employee master import (Master Data › Employees). One row per employee,
// matched by Code: an existing code is updated (blank cells leave the field
// as is), a new code is created, and a blank code gets the next number from
// the company's No. Series.

export type ImportRow = { row: number; code: string; name: string; action: "create" | "update" | "skip"; detail: string };
export type ImportIssue = { row: number; message: string };
export type ImportOutcome = { rows: ImportRow[]; issues: ImportIssue[]; canImport: boolean; created: number; updated: number };

export const EMPLOYEE_COLUMNS: TemplateColumn[] = [
  { header: "Code", note: "Employee code. Leave blank to auto-number. An existing code updates that employee.", text: true },
  { header: "Last Name", note: "Required for new employees.", required: true, width: 18 },
  { header: "First Name", note: "Required for new employees.", required: true, width: 18 },
  { header: "Middle Name", note: "", width: 16 },
  { header: "TIN", note: "e.g. 123-456-789-000", text: true, width: 18 },
  { header: "Position", note: "Job title.", width: 18 },
  { header: "Address", note: "House no., street.", width: 26 },
  { header: "Barangay", note: "", width: 16 },
  { header: "District", note: "", width: 14 },
  { header: "City", note: "City / municipality.", width: 16 },
  { header: "Province", note: "", width: 16 },
  { header: "Zip Code", note: "", text: true },
  { header: "Tel No", note: "", text: true, width: 14 },
  { header: "Cell No", note: "", text: true, width: 14 },
  { header: "Email", note: "", width: 24 },
  { header: "Active", note: "Yes or No. Blank = Yes for new employees.", choices: ["Yes", "No"] },
];

export function employeeTemplate() {
  return buildTemplate({
    sheetName: "Employees",
    title: "ARbixo employee import",
    intro: [
      "Fill one row per employee on the Employees sheet, starting at row 2. Keep the header row as is.",
      "Delete the example rows before uploading. Save as .xlsx (or CSV).",
      "A row whose Code already exists updates that employee; blank cells leave the current value.",
    ],
    columns: EMPLOYEE_COLUMNS,
    examples: [
      ["EMP-0101", "Dela Cruz", "Juan", "Santos", "123-456-789-000", "Driver", "12 Mabini St.", "San Isidro", "", "Quezon City", "Metro Manila", "1100", "", "09171234567", "juan@example.com", "Yes"],
      ["", "Reyes", "Maria", "", "", "Cashier", "", "", "", "Makati", "Metro Manila", "1200", "", "09181234567", "", "Yes"],
    ],
  });
}

const FIELDS = [
  ["lastName", "Last Name"], ["firstName", "First Name"], ["middleName", "Middle Name"], ["tin", "TIN"], ["position", "Position"],
  ["address", "Address"], ["barangay", "Barangay"], ["district", "District"], ["city", "City"], ["province", "Province"],
  ["zipCode", "Zip Code"], ["telNo", "Tel No", "Telephone"], ["cellNo", "Cell No", "Mobile", "Mobile No"], ["email", "Email", "Email Address"],
] as const;

type Planned = { row: number; code: string; id: string | null; data: Record<string, string | boolean> };

export async function importEmployees(companyId: string, sheet: SheetRow[], dryRun: boolean): Promise<ImportOutcome> {
  const existing = await prisma.employee.findMany({ where: { companyId }, select: { id: true, code: true, lastName: true, firstName: true } });
  const byCode = new Map(existing.map((e) => [e.code.toLowerCase(), e]));
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  const plan: Planned[] = [];
  const seen = new Set<string>();

  sheet.forEach((r, i) => {
    const rowNo = i + 2;
    const code = pick(r, ["Code", "Employee Code", "Emp No", "Employee No"]).trim();
    const data: Record<string, string | boolean> = {};
    for (const [key, ...headers] of FIELDS) {
      const v = pick(r, headers as unknown as string[]).trim();
      if (v) data[key] = v;
    }
    const active = toYesNo(pick(r, ["Active", "Is Active"]));
    if (active !== null) data.isActive = active;
    if (Object.keys(data).length === 0 && !code) return; // blank row

    const match = code ? byCode.get(code.toLowerCase()) : undefined;
    const name = `${data.lastName ?? match?.lastName ?? ""}, ${data.firstName ?? match?.firstName ?? ""}`.replace(/^, |, $/g, "");
    const fail = (message: string) => { issues.push({ row: rowNo, message }); rows.push({ row: rowNo, code, name, action: "skip", detail: message }); };

    if (code) {
      if (seen.has(code.toLowerCase())) return fail(`Code ${code} appears more than once in the file.`);
      seen.add(code.toLowerCase());
    }
    if (!match && (!data.lastName || !data.firstName)) return fail("Last name and first name are required for a new employee.");
    const textErr = validateEmployeeText(data as Record<string, string>);
    if (textErr) return fail(textErr);
    if (typeof data.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return fail(`Invalid email: ${data.email}`);

    plan.push({ row: rowNo, code, id: match?.id ?? null, data });
    rows.push({
      row: rowNo, code: code || "(auto)", name, action: match ? "update" : "create",
      detail: match ? `Updates ${Object.keys(data).length} field(s)` : [data.position, data.city].filter(Boolean).join(" · "),
    });
  });

  const outcome: ImportOutcome = { rows, issues, canImport: plan.length > 0, created: 0, updated: 0 };
  if (dryRun) return outcome;

  for (const p of plan) {
    try {
      if (p.id) {
        await prisma.employee.update({ where: { id: p.id }, data: p.data });
        outcome.updated++;
      } else {
        const code = p.code || (await nextPartyCode(companyId, "employee"));
        await prisma.employee.create({ data: { ...(p.data as { lastName: string; firstName: string }), companyId, code } });
        outcome.created++;
        const row = rows.find((x) => x.row === p.row);
        if (row) row.code = code;
      }
    } catch (e) {
      const message = e instanceof Error && /Unique constraint/i.test(e.message) ? "That code is already in use." : "Could not save this row.";
      issues.push({ row: p.row, message });
      const row = rows.find((x) => x.row === p.row);
      if (row) { row.action = "skip"; row.detail = message; }
    }
  }
  return outcome;
}
