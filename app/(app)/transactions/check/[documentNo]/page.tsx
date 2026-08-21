import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { pesosInWords } from "@/lib/amountInWords";
import { PrintControls } from "@/components/PrintControls";

// Printable check for a posted Cash Disbursement — meant to be fed through
// the printer directly onto the company's own pre-printed check stock
// (which already carries the bank's letterhead, "Pay to the order of" /
// "Pesos" labels, boxes, MICR line, and check number). So this only prints
// the variable details a person would otherwise write by hand: date,
// payee, amount in figures and in words, and the memo. No borders, boxes,
// or labels of its own — those would double up with what's already on the
// paper. Open with ?_embed=1 so the app chrome is hidden (see AppShell).
//
// Position is a best-effort default (roughly where those fields sit on a
// typical PH business check) — it will very likely need nudging to align
// with this company's actual check stock. Adjust the offsets below once
// you've done a test print and can see how far off each field is.
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

  const withParty = entries.find((e) => e.customer || e.vendor || e.employee || e.contact);
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
    <div className="mx-auto max-w-[820px] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: 8.5in 3.5in; margin: 0 } }`}</style>
      <PrintControls />

      <div className="relative h-[3.5in] w-[8.5in] max-w-full text-[13px] leading-tight">
        {/* Date — top-right, where the date field sits on most PH business checks. */}
        <div className="absolute right-[0.6in] top-[0.5in] font-mono text-sm">{dateStr}</div>

        {/* Payee — "Pay to the order of" line. */}
        <div className="absolute left-[0.6in] top-[1.35in] text-base font-medium">{payeeName}</div>

        {/* Amount in figures — the boxed ₱ amount, upper right. */}
        <div className="absolute right-[0.4in] top-[1.35in] text-right font-mono text-base font-semibold">{formatPeso(amount)}</div>

        {/* Amount in words — the "Pesos" line. */}
        <div className="absolute left-[0.6in] top-[1.75in] text-sm">
          {pesosInWords(amount)} Only {"*".repeat(20)}
        </div>

        {/* Memo. */}
        {memo && <div className="absolute left-[0.6in] top-[2.9in] text-[11px]">{memo}</div>}
      </div>
    </div>
  );
}
