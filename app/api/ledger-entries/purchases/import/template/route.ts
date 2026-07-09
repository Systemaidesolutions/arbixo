import { vatJournalTemplate } from "@/lib/vatJournalImport";

export async function GET() {
  return vatJournalTemplate("PURCHASE_ON_ACCOUNT");
}
