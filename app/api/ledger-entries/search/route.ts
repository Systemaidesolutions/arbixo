import { NextRequest, NextResponse } from "next/server";
import { searchLedgerDocuments } from "@/lib/ledgerSearch";
import type { JournalType } from "@prisma/client";

// Transaction-summary lookup for a journal. A blank term returns every
// document (newest first); otherwise matches doc no., description, reference
// no., check no., or counterparty name.
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const journalType = request.nextUrl.searchParams.get("journalType") as JournalType | null;
  const q = request.nextUrl.searchParams.get("q");

  if (!companyId || !journalType) {
    return NextResponse.json(
      { error: "companyId and journalType query parameters are required" },
      { status: 400 }
    );
  }

  const documents = await searchLedgerDocuments(companyId, journalType, q);
  return NextResponse.json({ documents });
}
