import { describe, it, expect } from "vitest";
import { base64Bytes, parseReimbursement, todayPH } from "./reimbursement";

const img = "data:image/jpeg;base64," + "A".repeat(400);
const ok = { expenseDate: "2026-11-04", category: "Meals", description: "Client lunch", amount: "350.50", attachments: [{ fileName: "r.jpg", dataUrl: img }] };

describe("parseReimbursement", () => {
  it("accepts a valid filing", () => {
    const r = parseReimbursement(ok, "2026-11-05");
    expect(typeof r).toBe("object");
    if (typeof r === "object") {
      expect(r.amount).toBe(350.5);
      expect(r.attachments[0]).toMatchObject({ contentType: "image/jpeg", sizeBytes: 300 });
    }
  });
  it("rejects bad input", () => {
    expect(parseReimbursement({ ...ok, expenseDate: "2026-11-06" }, "2026-11-05")).toMatch(/future/);
    expect(parseReimbursement({ ...ok, category: "Bribes" }, "2026-11-05")).toMatch(/category/);
    expect(parseReimbursement({ ...ok, description: "  " }, "2026-11-05")).toMatch(/Describe/);
    expect(parseReimbursement({ ...ok, amount: "0" }, "2026-11-05")).toMatch(/amount/);
    expect(parseReimbursement({ ...ok, attachments: [] }, "2026-11-05")).toMatch(/receipt/);
    expect(parseReimbursement({ ...ok, attachments: [{ fileName: "x", dataUrl: "data:text/html;base64,AAAA" }] }, "2026-11-05")).toMatch(/JPG/);
    expect(parseReimbursement({ ...ok, attachments: [ok.attachments[0], ok.attachments[0], ok.attachments[0], ok.attachments[0]] }, "2026-11-05")).toMatch(/at most/);
    const big = "data:image/png;base64," + "A".repeat(2_100_000);
    expect(parseReimbursement({ ...ok, attachments: [{ fileName: "b", dataUrl: big }] }, "2026-11-05")).toMatch(/under/);
  });
  it("helpers", () => {
    expect(base64Bytes("AAAA")).toBe(3);
    expect(base64Bytes("AAA=")).toBe(2);
    expect(todayPH(new Date("2026-11-05T17:00:00Z"))).toBe("2026-11-06");
  });
});
