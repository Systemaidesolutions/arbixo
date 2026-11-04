import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {
  employee: { findMany: async () => [{ id: "e1", code: "EMP-0101", lastName: "Dela Cruz", firstName: "Juan", payrollProfile: null }] },
  payGroup: { findMany: async () => [{ id: "g1", code: "WEEKLY", name: "Weekly" }] },
  location: { findMany: async () => [] },
} }));
vi.mock("@/lib/numberSeriesServer", () => ({ nextPartyCode: async () => "X" }));
vi.mock("@/lib/payroll/masters", () => ({ saveProfile: async () => ({ status: 200 }) }));
import { parseImportFile } from "./transactionImportParse";
import { employeeTemplate } from "./employeeImport";
import { importProfiles, profileTemplate } from "./payroll/profileImport";
import { toYesNo } from "./xlsxTemplate";

describe("import templates", () => {
  it("employee template round-trips through the import parser", async () => {
    const rows = await parseImportFile(await employeeTemplate(), "t.xlsx");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: "EMP-0101", lastname: "Dela Cruz", firstname: "Juan", zipcode: "1100", active: "Yes" });
  });
  it("payroll template keeps IDs and times as text", async () => {
    const rows = await parseImportFile(await profileTemplate(), "t.xlsx");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ employeecode: "EMP-0101", paybasis: "Daily", rate: "695", sssno: "34-1234567-8", restdaytype: "Not fixed" });
    expect(rows[1]).toMatchObject({ shiftstart: "08:00", restdays: "Sun", bankaccountno: "001234567890" });
  });
  it("yes/no cells", () => {
    expect(toYesNo("Yes")).toBe(true);
    expect(toYesNo("n")).toBe(false);
    expect(toYesNo("")).toBeNull();
  });
});

describe("payroll employee import (dry run)", () => {
  it("matches codes, creates missing employees with names, and reports bad rows", async () => {
    const sheet = await parseImportFile(await profileTemplate(), "t.xlsx");
    const out = await importProfiles("c1", [
      sheet[0],
      { ...sheet[1], employeecode: "EMP-0102", branch: "", paygroup: "weekly" }, // new employee (names given), no branch
      { employeecode: "NOPE", paybasis: "Daily", rate: "500", employmenttype: "Casual" }, // unknown, no names
      { employeecode: "EMP-0103", lastname: "A", firstname: "B", employmenttype: "Casual", paybasis: "Weekly", rate: "1" },
    ], true);
    expect(out.rows.map((r) => r.action)).toEqual(["create", "create", "skip", "skip"]);
    expect(out.rows[1].detail).toMatch(/New employee/);
    expect(out.issues.map((i) => i.row)).toEqual([4, 5]);
    expect(out.canImport).toBe(true);
  });
});
