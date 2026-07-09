import { NextResponse } from "next/server";

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET() {
  const headers = ["Code", "Description", "Rate Percent", "Income Payment Type", "Active"];
  const example = [
    ["WI010", "Professional/talent fees — Individual (≤ ₱3M)", "5", "Services", "Yes"],
    ["WC158", "Top Withholding Agent — purchase of goods — Corporate", "1", "Goods", "Yes"],
  ];
  const csv = "﻿" + [headers, ...example].map((r) => r.map(esc).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="atc-codes-import-template.csv"',
    },
  });
}
