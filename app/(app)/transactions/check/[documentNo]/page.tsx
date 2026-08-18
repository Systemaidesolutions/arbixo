import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { pesosInWords } from "@/lib/amountInWords";
import { PrintControls } from "@/components/PrintControls";

// A single boxed digit, e.g. for the MM-DD-YYYY date field standard on PH
// bank checks (each digit gets its own box rather than a plain typed date).
function DigitBox({ d }: { d: string }) {
  return (
    <span className="flex h-6 w-5 items-center justify-center border border-neutral-800 font-mono text-sm">
      {d}
    </span>
  );
}

// Printable check for a posted Cash Disbursement — the check itself (payee,
// date, amount in words and figures, memo, signature line), separate from
// the internal Check Voucher at /transactions/voucher. Open with ?_embed=1
// so the app chrome is hidden (see AppShell). Sized to a standard business
// check (8.5in x 3.5in) so it can be printed directly onto check stock;
// print margins are zeroed so the printer's own paper-feed/tray handles
// alignment to the physical check. Field layout (Account Name as its own
// line, PESOS label left of the amount-in-words line, boxed date digits)
// modeled after an actual RCBC business check.
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
  const checkNo = entries.find((e) => e.checkNo)?.checkNo || documentNo;
  const bankAccountLabel = cashLine?.account.title ?? "";
  const memo = entries.find((e) => e.description)?.description || entries.find((e) => e.lineDescription)?.lineDescription || "";

  const companyName = company.registeredName || company.tradeName;
  const d = new Date(entries[0].postingDate);
  const dateDigits = [
    ...String(d.getMonth() + 1).padStart(2, "0"),
    ...String(d.getDate()).padStart(2, "0"),
    ...String(d.getFullYear()),
  ];

  return (
    <div className="mx-auto max-w-[820px] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: 8.5in 3.5in; margin: 0 } }`}</style>
      <PrintControls />

      <div className="relative h-[3.5in] w-[8.5in] max-w-full border border-neutral-800 p-5 text-[13px] leading-tight print:border-0">
        {/* Top: bank/cash-account letterhead + check no. */}
        <div className="flex items-start justify-between">
          <div className="leading-tight">
            {bankAccountLabel && <div className="text-sm font-bold uppercase">{bankAccountLabel}</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] text-neutral-500">CHECK NO.</div>
            <div className="font-mono text-sm font-semibold">{checkNo}</div>
          </div>
        </div>

        {/* Account Name (the drawer — this company) + boxed date */}
        <div className="mt-3 flex items-end justify-between">
          <div className="flex-1">
            <span className="text-[11px] text-neutral-500">ACCOUNT NAME</span>
            <div className="mt-1 border-b border-neutral-800 pb-1 text-sm font-medium uppercase">{companyName}</div>
          </div>
          <div className="ml-4 shrink-0 text-center">
            <div className="text-[11px] text-neutral-500">DATE</div>
            <div className="mt-1 flex items-center gap-0.5">
              {dateDigits.slice(0, 2).map((c, i) => <DigitBox key={`m${i}`} d={c} />)}
              <span className="mx-0.5">-</span>
              {dateDigits.slice(2, 4).map((c, i) => <DigitBox key={`d${i}`} d={c} />)}
              <span className="mx-0.5">-</span>
              {dateDigits.slice(4, 8).map((c, i) => <DigitBox key={`y${i}`} d={c} />)}
            </div>
          </div>
        </div>

        {/* Pay to the order of + boxed amount in figures */}
        <div className="mt-5 flex items-end gap-3">
          <div className="flex-1">
            <span className="text-[11px] text-neutral-500">PAY TO THE ORDER OF</span>
            <div className="mt-1 border-b border-neutral-800 pb-1 text-base font-medium">{payeeName}</div>
          </div>
          <div className="w-40 shrink-0 border border-neutral-800 px-2 py-1 text-right">
            <span className="text-[10px] text-neutral-500">₱</span>
            <span className="ml-1 font-mono text-base font-semibold">{formatPeso(amount)}</span>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-3 flex items-end gap-2">
          <span className="text-[11px] text-neutral-500">PESOS</span>
          <div className="flex-1 border-b border-neutral-800 pb-1 text-sm">
            {pesosInWords(amount)} Only {"*".repeat(20)}
          </div>
        </div>

        {/* Memo + signature */}
        <div className="mt-8 flex items-end justify-between">
          <div className="text-[11px]">
            <span className="text-neutral-500">Memo:</span> {memo}
          </div>
          <div className="text-center">
            <div className="w-56 border-b border-neutral-800 pb-1">&nbsp;</div>
            <div className="mt-1 text-[10px] text-neutral-500">Authorized Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
