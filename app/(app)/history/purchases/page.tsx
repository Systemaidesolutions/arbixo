import { redirect } from "next/navigation";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { LedgerEntriesBrowser } from "../LedgerEntriesBrowser";

export default async function PurchaseHistoryPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  if (user.role !== "USER" || !capabilitiesFor(user.role, user.subscriberSubtype).canApprove) redirect("/");
  return (
    <LedgerEntriesBrowser
      kind="purchase"
      title="Purchase entries"
      description="Posted purchase and cash-disbursement ledger entries. Filter by date or search by document, account, or particulars."
    />
  );
}
