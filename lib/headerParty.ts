import type { JournalType } from "@prisma/client";

type PartyLine = { customer?: unknown; vendor?: unknown; employee?: unknown; contact?: unknown };

const hasParty = (e: PartyLine) => Boolean(e.customer || e.vendor || e.employee || e.contact);

// For Cash Disbursement and Purchase on Account the payee/supplier chosen on
// the header is stamped on the balancing (cash / payable) line, which is
// posted last; expense lines may carry a different per-line party. Prints
// must show the header payee, so look at the balancing line first and only
// fall back to any other line when no header payee was selected.
export function pickHeaderPartyLine<T extends PartyLine>(entries: T[], journalType: JournalType): T | undefined {
  if (journalType === "CASH_DISBURSEMENT" || journalType === "PURCHASE_ON_ACCOUNT") {
    const balancing = entries[entries.length - 1];
    if (balancing && hasParty(balancing)) return balancing;
  }
  return entries.find(hasParty);
}
