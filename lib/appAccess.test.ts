import { describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ headers: () => new Map([["x-arbixo-path", "/payroll/runs"]]) }));
import { appForRequestPath, canUseCurrentPath, cleanAppList, userApps } from "./appAccess";

describe("app access", () => {
  it("maps paths to apps", () => {
    expect(appForRequestPath("/payroll")).toBe("payroll");
    expect(appForRequestPath("/api/payroll/runs/1")).toBe("payroll");
    expect(appForRequestPath("/transactions/sales")).toBe("accounting");
    expect(appForRequestPath("/api/reports/x")).toBe("accounting");
    expect(appForRequestPath("/agents/employees")).toBeNull();
    expect(appForRequestPath("/api/ledger-entries/cancel")).toBeNull();
    expect(appForRequestPath("/payrollx")).toBeNull();
  });
  it("defaults and cleans", () => {
    expect(cleanAppList(["payroll", "x", "payroll", "accounting"])).toEqual(["accounting", "payroll"]);
    expect(userApps({ role: "USER", appAccess: [] })).toEqual(["accounting", "payroll"]);
    expect(userApps({ role: "USER", appAccess: ["payroll"] })).toEqual(["payroll"]);
    expect(userApps({ role: "ADMIN", appAccess: ["payroll"] })).toEqual(["accounting", "payroll"]);
  });
  it("blocks the current path when the app isn't assigned", () => {
    expect(canUseCurrentPath({ role: "USER", appAccess: ["accounting"] })).toBe(false);
    expect(canUseCurrentPath({ role: "USER", appAccess: ["payroll"] })).toBe(true);
  });
});
