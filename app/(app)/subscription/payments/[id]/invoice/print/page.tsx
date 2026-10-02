import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord, getCurrentCapability, effectiveCompanyId } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";
import { getBusinessProfile, computeVatBreakdown, invoicePeriodLabel } from "@/lib/subscriptionInvoice";
import { formatPeso, formatDate } from "@/lib/format";
import { PrintControls } from "@/components/PrintControls";

export const maxDuration = 60;

export default async function SubscriptionInvoicePrintPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: params.id },
    include: { company: true },
  });
  if (!payment || !payment.invoiceNo) notFound();

  const isPlatformAdmin = user.role === "ADMIN" && !getAdminActingAsCompanyId();
  if (!isPlatformAdmin) {
    const companyId = await effectiveCompanyId();
    const cap = await getCurrentCapability();
    const isManager = !!companyId && !!cap?.canApprove;
    if (!isManager || companyId !== payment.companyId) notFound();
  }

  const seller = await getBusinessProfile();
  const buyer = payment.company;
  const amountDue = Number(payment.amountDue);
  const discountAmount = Number(payment.discountAmount);
  const vat = computeVatBreakdown(amountDue, discountAmount);
  const periodLabel = invoicePeriodLabel(payment.periodStart, payment.periodEnd);

  const th = "border border-neutral-400 px-2 py-1 text-left align-middle font-semibold";
  const td = "border border-neutral-300 px-2 py-1 align-top";
  const tdNum = `${td} text-right font-mono whitespace-nowrap`;
  const row = "flex justify-between py-0.5 text-[10px]";

  return (
    <main className="mx-auto max-w-[8.5in] bg-white p-6 text-neutral-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 0.4in } html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <PrintControls auto={false} />

      <div className="border-2 border-neutral-800 p-4 text-[11px]">
        <div className="flex items-start justify-between border-b-2 border-neutral-800 pb-3">
          <div>
            <div className="text-lg font-bold">{seller.tradeName || "ARbixo"}</div>
            <div>{seller.registeredName}</div>
            <div className="max-w-[320px]">{seller.address}</div>
            <div>TIN: <span className="font-mono">{seller.tin || "—"}</span> {seller.rdoCode && `· RDO ${seller.rdoCode}`}</div>
            {seller.telephone && <div>Tel: {seller.telephone}</div>}
            <div>{seller.registrationType}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-wide">SALES INVOICE</div>
            <div className="mt-1">No. <span className="font-mono font-bold">{payment.invoiceNo}</span></div>
            <div>Date: {payment.invoiceIssuedAt ? formatDate(payment.invoiceIssuedAt) : "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b-2 border-neutral-800 py-3">
          <div>
            <div className="text-neutral-500">Billed to</div>
            <div className="font-semibold">{buyer.tradeName}</div>
            {buyer.registeredName && buyer.registeredName !== buyer.tradeName && <div>{buyer.registeredName}</div>}
            <div className="max-w-[320px]">{buyer.businessAddress}</div>
            <div>TIN: <span className="font-mono">{buyer.tin}</span></div>
          </div>
          <div className="text-right">
            <div className="text-neutral-500">Billing period</div>
            <div className="font-semibold">{periodLabel}</div>
          </div>
        </div>

        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>
                ARbixo subscription — {payment.priceName} — {periodLabel}
              </td>
              <td className={tdNum}>{formatPeso(Number(payment.baseAmount))}</td>
            </tr>
            {discountAmount > 0 && (
              <tr>
                <td className={td}>Voucher discount {payment.voucherCode ? `(${payment.voucherCode})` : ""}</td>
                <td className={tdNum}>({formatPeso(discountAmount)})</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          <div className="w-64 border border-neutral-400 p-2">
            <div className={row}><span>VATable Sales</span><span className="font-mono">{formatPeso(vat.vatableSales)}</span></div>
            <div className={row}><span>VAT-Exempt Sales</span><span className="font-mono">{formatPeso(vat.vatExemptSales)}</span></div>
            <div className={row}><span>Zero-Rated Sales</span><span className="font-mono">{formatPeso(vat.zeroRatedSales)}</span></div>
            <div className={`${row} border-t border-neutral-300 mt-1 pt-1`}><span>Total Sales</span><span className="font-mono">{formatPeso(vat.totalSales)}</span></div>
            <div className={row}><span>Add: 12% VAT</span><span className="font-mono">{formatPeso(vat.vatAmount)}</span></div>
            <div className={`${row} border-t-2 border-neutral-800 mt-1 pt-1 text-xs font-bold`}><span>Total Amount Due</span><span className="font-mono">{formatPeso(vat.totalAmountDue)}</span></div>
          </div>
        </div>

        <div className="mt-6 border-t border-neutral-300 pt-2 text-[9px] text-neutral-500">
          <div>
            ATP No. {seller.atpNumber || "—"}
            {seller.atpSeriesFrom && seller.atpSeriesTo ? ` · Series ${seller.atpSeriesFrom} to ${seller.atpSeriesTo}` : ""}
            {seller.atpValidUntil ? ` · Valid until ${formatDate(new Date(seller.atpValidUntil))}` : ""}
          </div>
          <div className="mt-1">This document is system-generated and serves as a record copy of the above-numbered invoice.</div>
        </div>
      </div>
    </main>
  );
}
