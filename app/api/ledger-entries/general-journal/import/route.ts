import { NextRequest } from "next/server";
import { handleGeneralJournalImport } from "@/lib/generalJournalImport";

export async function POST(request: NextRequest) {
  return handleGeneralJournalImport(request);
}
