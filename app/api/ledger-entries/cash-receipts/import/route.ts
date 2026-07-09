import { NextRequest } from "next/server";
import { handleVatJournalImport } from "@/lib/vatJournalImport";

export async function POST(request: NextRequest) {
  return handleVatJournalImport(request, "CASH_RECEIPT");
}
