import { redirect } from "next/navigation";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { LedgerEntriesBrowser } from "../LedgerEntriesBrowser";

export default async function GeneralLedgerHistoryPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  if (user.role !== "USER" || !capabilitiesFor(user.role, user.subscriberSubtype).canApprove) redirect("/");
  return (
    <LedgerEntriesBrowser
      kind="all"
      title="General ledger entries"
      description="Every posted ledger line across all journals — the complete general ledger. Filter by date or search by document, account, or particulars."
    />
  );
}
