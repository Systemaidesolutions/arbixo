import { redirect } from "next/navigation";
import { getCurrentUserRecord, getCurrentCapability } from "@/lib/currentUser";
import { LedgerEntriesBrowser } from "../LedgerEntriesBrowser";

export default async function SalesHistoryPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) redirect("/dashboard");
  return (
    <LedgerEntriesBrowser
      kind="sales"
      title="Sales entries"
      description="Posted sales and cash-receipt ledger entries. Filter by date or search by document, account, or particulars."
    />
  );
}
