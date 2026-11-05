import { describe, expect, it } from "vitest";
import { allowed, apiRequirement, cleanDenied, pageRequirement, unmet } from "./userPermissions";

describe("user access groups", () => {
  it("cleans lists", () => {
    expect(cleanDenied(["viewReports", "bogus", "transactions", "viewReports"])).toEqual(["transactions", "viewReports"]);
    expect(cleanDenied(null)).toEqual([]);
  });

  it("gates pages", () => {
    expect(allowed(["transactions"], pageRequirement("/transactions/sales"))).toBe(false);
    expect(allowed(["importTransactions"], pageRequirement("/transactions/sales"))).toBe(true);
    expect(allowed(["importTransactions"], pageRequirement("/transactions/sales/import"))).toBe(false);
    expect(allowed(["viewReports"], pageRequirement("/books/general-ledger"))).toBe(false);
    expect(allowed(["printReports"], pageRequirement("/reports/trial-balance"))).toBe(true);
    expect(allowed(["printReports"], pageRequirement("/reports/trial-balance/print"))).toBe(false);
    expect(allowed(["printReports"], pageRequirement("/transactions/voucher/GENERAL_JOURNAL/GJ-1"))).toBe(false);
    expect(allowed(["viewSetup"], pageRequirement("/agents/customers"))).toBe(false);
    expect(allowed(["viewSetup"], pageRequirement("/payroll/employee-records"))).toBe(false);
    expect(allowed(["viewHistory"], pageRequirement("/history/transactions/sales"))).toBe(false);
    expect(allowed(["viewHistory", "viewSetup", "transactions"], pageRequirement("/dashboard"))).toBe(true);
    expect(allowed(["viewHistory", "viewSetup"], pageRequirement("/payroll/runs"))).toBe(true);
  });

  it("lets a posted document open from history without transaction access", () => {
    const req = pageRequirement("/transactions/view/SALES_ON_ACCOUNT/SI-1");
    expect(allowed(["transactions"], req)).toBe(true);
    expect(allowed(["transactions", "viewHistory", "viewReports"], req)).toBe(false);
  });

  it("gates API writes, files and printing, not reads", () => {
    expect(apiRequirement("/api/customers", "GET")).toEqual([]);
    expect(unmet(["changeSetup"], apiRequirement("/api/customers", "POST"))).toEqual(["changeSetup"]);
    expect(unmet(["transactions"], apiRequirement("/api/ledger-entries/sales", "POST"))).toEqual(["transactions"]);
    expect(unmet(["importTransactions"], apiRequirement("/api/ledger-entries/sales/import", "POST"))).toEqual(["importTransactions"]);
    expect(allowed(["importTransactions"], apiRequirement("/api/ledger-entries/sales/import/template", "GET"))).toBe(true);
    expect(unmet(["exportFiles"], apiRequirement("/api/export/xlsx", "POST"))).toEqual(["exportFiles"]);
    expect(unmet(["exportFiles"], apiRequirement("/api/reports/bir/sls/dat", "GET"))).toEqual(["exportFiles"]);
    expect(unmet(["printReports"], apiRequirement("/api/transactions/2307/pdf", "GET"))).toEqual(["printReports"]);
    expect(apiRequirement("/api/payroll/runs", "POST")).toEqual([]);
    expect(apiRequirement("/api/ledger-entries/cancel", "POST", "/payroll/runs/abc")).toEqual([]);
  });
});
