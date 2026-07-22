import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/currentUser";
import { getJournalBook, JOURNAL_BOOKS } from "@/lib/booksOfAccounts";
import { resolveBranchScope } from "@/lib/branchScope";

// One of the journal books (cash-receipts / cash-disbursement / general-journal
// / sales / purchases) for a date range.
export async function GET(request: NextRequest) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: "No company." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const book = sp.get("book") ?? "";
  const cfg = JOURNAL_BOOKS[book];
  if (!cfg) return NextResponse.json({ error: "Unknown book." }, { status: 400 });

  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });

  const branch = await resolveBranchScope(company.id, sp.get("locationId"));

  const data = await getJournalBook(
    company.id,
    cfg.journalTypes,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59.999`),
    branch
  );
  return NextResponse.json({ label: cfg.label, ...data });
}
