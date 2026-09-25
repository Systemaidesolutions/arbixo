import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { pesosInWords } from "@/lib/amountInWords";
import { CheckPrintClient } from "./CheckPrintClient";
import { pickHeaderPartyLine } from "@/lib/headerParty";

// Printable check for a posted Cash Disbursement — meant to be fed through
// the printer directly onto the company's own pre-printed check stock
// (which already carries the bank's letterhead, "Pay to the order of" /
// "Pesos" labels, boxes, MICR line, and check number). So this only prints
// the variable details a person would otherwise write by hand: date,
// payee, amount in figures and in words, and the memo. No borders, boxes,
// or labels of its own — those would double up with what's already on the
// paper. Open with ?_embed=1 so the app chrome is hidden (see AppShell).
//
// Field positions (and the check's own width/height) are a best-effort
// default — exact placement inherently depends on this company's specific
// check stock AND printer margins, neither of which can be known ahead of
// time. Rather than hardcode a guess, CheckPrintClient exposes an on-screen
// "Adjust alignment" panel (with a printable ruler grid) so whoever has the
// actual paper can calibrate it themselves in one test print; the result is
// saved per-device and reused for every check after that.
export default async function CheckPage({ params }: { params: { documentNo: string } }) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const documentNo = decodeURIComponent(params.documentNo);
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id, journalType: "CASH_DISBURSEMENT", documentNo },
    include: { account: true, customer: true, vendor: true, employee: true, contact: true },
    orderBy: { lineNo: "asc" },
  });
  if (entries.length === 0) notFound();

  const withParty = pickHeaderPartyLine(entries, "CASH_DISBURSEMENT");
  const p = withParty?.customer || withParty?.vendor || withParty?.contact;
  const payeeName =
    p?.registeredName || p?.tradeName ||
    (withParty?.employee ? [withParty.employee.firstName, withParty.employee.middleName, withParty.employee.lastName].filter(Boolean).join(" ") : null) ||
    [p?.lastName, p?.firstName].filter(Boolean).join(", ") || "";

  const cashLine = entries.find((e) => e.account.classification === "CASH_IN_BANK" || e.account.classification === "CASH_ON_HAND");
  const amount = Number(cashLine?.creditAmount ?? entries.reduce((s, e) => s + Number(e.creditAmount), 0));
  const memo = entries.find((e) => e.description)?.description || entries.find((e) => e.lineDescription)?.lineDescription || "";

  const d = new Date(entries[0].postingDate);
  const dateStr = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <CheckPrintClient
      dateStr={dateStr}
      payeeName={payeeName}
      amountFormatted={formatPeso(amount)}
      amountWords={pesosInWords(amount, { slash: false })}
      memo={memo}
    />
  );
}
