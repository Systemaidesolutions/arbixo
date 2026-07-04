import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { browseLedgerEntries } from "@/lib/ledgerBrowse";
import type { JournalType } from "@prisma/client";

const PAGE_SIZE = 100;

const KIND_JOURNALS: Record<string, JournalType[]> = {
  sales: ["SALES_ON_ACCOUNT", "CASH_RECEIPT"],
  purchase: ["PURCHASE_ON_ACCOUNT", "CASH_DISBURSEMENT"],
  all: [],
};

// Manager-only history browser (sales / purchase / general ledger entries).
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  if (!capabilitiesFor(user.role, user.subscriberSubtype).canApprove) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "all";
  const journalTypes = KIND_JOURNALS[kind] ?? [];
  const from = sp.get("from");
  const to = sp.get("to");
  const search = sp.get("q")?.trim() || undefined;
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const data = await browseLedgerEntries(user.companyId, {
    journalTypes,
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999`) : undefined,
    search,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  return NextResponse.json({ ...data, page, pageSize: PAGE_SIZE });
}
