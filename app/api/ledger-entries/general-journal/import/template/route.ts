import { generalJournalTemplate } from "@/lib/generalJournalImport";

export async function GET() {
  return generalJournalTemplate();
}
