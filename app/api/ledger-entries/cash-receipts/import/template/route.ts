import { vatJournalTemplate } from "@/lib/vatJournalImport";

export async function GET() {
  return vatJournalTemplate("CASH_RECEIPT");
}
