import { redirect } from "next/navigation";
import { getCurrentUserRecord, getCurrentCapability } from "@/lib/currentUser";
import { LedgerEntriesBrowser } from "../LedgerEntriesBrowser";

export default async function PurchaseHistoryPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) redirect("/dashboard");
  return (
    <LedgerEntriesBrowser
      kind="purchase"
      title="Purchase entries"
      description="Posted purchase and cash-disbursement ledger entries. Filter by date or search by document, account, or particulars."
    />
  );
}
