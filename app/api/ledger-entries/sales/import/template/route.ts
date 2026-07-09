import { vatJournalTemplate } from "@/lib/vatJournalImport";

export async function GET() {
  return vatJournalTemplate("SALES_ON_ACCOUNT");
}
