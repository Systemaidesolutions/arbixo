import { NextRequest, NextResponse } from "next/server";
import { suggestNextDocumentNo } from "@/lib/ledgerPosting";
import type { JournalType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const journalType = request.nextUrl.searchParams.get("journalType") as JournalType | null;
  if (!companyId || !journalType) {
    return NextResponse.json(
      { error: "companyId and journalType query parameters are required" },
      { status: 400 }
    );
  }
  const documentNo = await suggestNextDocumentNo(companyId, journalType);
  return NextResponse.json({ documentNo });
}
