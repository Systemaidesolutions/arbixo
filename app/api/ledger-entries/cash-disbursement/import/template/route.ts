import { NextResponse } from "next/server";

// A ready-to-fill CSV template for the Cash Disbursement importer. One row per
// expense line; rows sharing a CV no. combine into one voucher (header fields
// are read from that CV's first row). Open/save it in Excel too.
const HEADERS = [
  "CV No",
  "Date",
  "Check No",
  "Branch Code",
  "Payee Type",
  "Payee Name",
  "Cash Account Code",
  "Particulars",
  "Account Code",
  "Nature",
  "VAT Type",
  "Amount",
  "Amount Is Gross",
  "ATC Code",
];

// Example: CV-2026-001 is a single-line voucher; CV-2026-002 has two lines
// (second row only needs CV No + the line columns).
const EXAMPLE: string[][] = [
  ["CV-2026-001", "2026-07-09", "001234", "00000", "Vendor", "ABC Trading Corp.", "10100", "Office supplies", "60150", "Goods", "VAT", "11200", "Gross", ""],
  ["CV-2026-002", "2026-07-09", "", "00000", "Employee", "Dela Cruz, Juan", "10100", "Reimbursement", "60200", "Services", "Non-VAT", "3000", "Gross", "WC010"],
  ["CV-2026-002", "", "", "", "", "", "", "", "60210", "Goods", "Non-VAT", "500", "Gross", ""],
];

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET() {
  const lines = [HEADERS, ...EXAMPLE].map((r) => r.map(esc).join(","));
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cash-disbursement-import-template.csv"',
    },
  });
}
