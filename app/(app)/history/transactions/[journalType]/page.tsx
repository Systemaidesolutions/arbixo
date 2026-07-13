import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { PostedTransactionsBrowser } from "@/components/PostedTransactionsBrowser";
import type { JournalType } from "@prisma/client";

// Posted-transaction history, one page per journal. The URL slug maps to a
// JournalType; the browser lists one row per document with in-page filters.
const SLUGS: Record<string, { journalType: JournalType; title: string; description: string }> = {
  "cash-receipts": { journalType: "CASH_RECEIPT", title: "Cash Receipts — History", description: "Posted Cash Receipt documents." },
  sales: { journalType: "SALES_ON_ACCOUNT", title: "Sales on Account — History", description: "Posted Sales on Account documents." },
  "cash-disbursement": { journalType: "CASH_DISBURSEMENT", title: "Cash Disbursement — History", description: "Posted Cash Disbursement documents." },
  purchases: { journalType: "PURCHASE_ON_ACCOUNT", title: "Purchase on Account — History", description: "Posted Purchase on Account documents." },
  "general-journal": { journalType: "GENERAL_JOURNAL", title: "General Journal — History", description: "Posted General Journal documents." },
};

export default async function PostedTransactionsPage({ params }: { params: { journalType: string } }) {
  const meta = SLUGS[params.journalType];
  if (!meta) notFound();

  const company = await requirePostingCompany();
  if (!company) notFound();

  return (
    <PostedTransactionsBrowser
      companyId={company.id}
      journalType={meta.journalType}
      title={meta.title}
      description={meta.description}
    />
  );
}
