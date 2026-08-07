import { redirect } from "next/navigation";
import { getCurrentUserRecord, getCurrentCapability } from "@/lib/currentUser";
import { LedgerEntriesBrowser } from "../LedgerEntriesBrowser";

export default async function GeneralLedgerHistoryPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) redirect("/dashboard");
  return (
    <LedgerEntriesBrowser
      kind="all"
      title="General ledger entries"
      description="Every posted ledger line across all journals — the complete general ledger. Filter by date or search by document, account, or particulars."
    />
  );
}
