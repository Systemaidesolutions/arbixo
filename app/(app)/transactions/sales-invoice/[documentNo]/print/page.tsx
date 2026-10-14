import { notFound } from "next/navigation";
import { requirePostingCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { pickHeaderPartyLine } from "@/lib/headerParty";
import { computeDocumentVatBreakdown } from "@/lib/salesInvoice";
import { formatPeso, formatDate } from "@/lib/format";
import { REGISTRATION_TYPE_LABELS } from "@/lib/company";
import { PrintControls } from "@/components/PrintControls";

export const maxDuration = 60;

export default async function SalesInvoicePrintPage({ params }: { params: { documentNo: string } }) {
  const company = await requirePostingCompany();
  if (!company) notFound();

  const documentNo = decodeURIComponent(params.documentNo);
  const [invoice, entries] = await Promise.all([
    prisma.salesInvoice.findUnique({ where: { companyId_documentNo: { companyId: company.id, documentNo } } }),
    prisma.ledgerEntry.findMany({
      where: { companyId: company.id, journalType: "SALES_ON_ACCOUNT", documentNo },
      include: { account: true, customer: true, contact: true },
      orderBy: { lineNo: "asc" },
    }),
  ]);
  // No invoice issued yet for this document — generate one from the
  // transaction view ("Create e-invoice") rather than from this URL
  // directly, so viewing/printing never silently consumes a number.
  if (!invoice || entries.length === 0) notFound();

  const withParty = pickHeaderPartyLine(entries, "SALES_ON_ACCOUNT");
  const buyer = withParty?.customer ?? withParty?.contact ?? null;
  const buyerName = buyer?.registeredName || buyer?.tradeName || "—";
  const buyerAddress = buyer
    ? [buyer.address, buyer.barangay, buyer.district, buyer.city, buyer.province, buyer.zipCode].filter(Boolean).join(", ")
    : "";

  const vat = computeDocumentVatBreakdown(entries);
  // Line items: the main income lines (the ones that carry a net amount —
  // not the AR balancing line, not the VAT companion line), same filter the
  // Sales Voucher print page uses for its own Particulars table.
  const particulars = entries
    .filter((e) => Number(e.netAmount ?? 0) > 0)
    .map((e) => ({ name: e.lineDescription || e.account.title, amount: Number(e.netAmount) + Number(e.vatAmount ?? 0) }));

  const sellerAddress = [company.businessAddress, company.barangay, company.district, company.city, company.province, company.zipCode]
    .filter(Boolean)
    .join(", ");

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
            <div className="text-lg font-bold">{company.tradeName}</div>
            {company.registeredName && company.registeredName !== company.tradeName && <div>{company.registeredName}</div>}
            <div className="max-w-[320px]">{sellerAddress}</div>
            <div>TIN: <span className="font-mono">{company.tin || "—"}</span> {company.rdoCode && `· RDO ${company.rdoCode}`}</div>
            {company.telNo && <div>Tel: {company.telNo}</div>}
            <div>{REGISTRATION_TYPE_LABELS[company.registrationType]}</div>
          </div>
          <div className="text-right">
            {/* "Invoice" — EOPT Act (RA 11976) unified Sales Invoice and
                Official Receipt into one document type for both goods and
                services. */}
            <div className="text-xl font-bold tracking-wide">INVOICE</div>
            <div className="mt-1">No. <span className="font-mono font-bold">{invoice.invoiceNo}</span></div>
            <div>Date: {formatDate(invoice.issuedAt)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b-2 border-neutral-800 py-3">
          <div>
            <div className="text-neutral-500">Billed to</div>
            <div className="font-semibold">{buyerName}</div>
            <div className="max-w-[320px]">{buyerAddress}</div>
            <div>TIN: <span className="font-mono">{buyer?.tin ?? "—"}</span></div>
          </div>
          <div className="text-right">
            <div className="text-neutral-500">Reference</div>
            <div className="font-semibold">{documentNo}</div>
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
            {particulars.length > 0 ? (
              particulars.map((p, i) => (
                <tr key={i}>
                  <td className={td}>{p.name}</td>
                  <td className={tdNum}>{formatPeso(p.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className={td}>{documentNo}</td>
                <td className={tdNum}>{formatPeso(vat.totalAmountDue)}</td>
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

        <div className="mt-8 flex justify-end">
          <div className="w-56 text-center text-[10px]">
            <div className="border-b border-neutral-800 pb-6" />
            <div className="mt-1 font-medium">Authorized Representative</div>
          </div>
        </div>

        <div className="mt-6 border-t border-neutral-300 pt-2 text-[9px] text-neutral-500">
          <div>
            ATP No. {company.atpNumber || "—"}
            {company.atpSeriesFrom || company.atpSeriesTo
              ? ` · Series ${company.atpSeriesFrom || "—"} to ${company.atpSeriesTo || "—"}`
              : ""}
            {company.atpValidUntil ? ` · Valid until ${formatDate(new Date(company.atpValidUntil))}` : ""}
          </div>
          <div className="mt-1">This document is system-generated and serves as a record copy of the above-numbered invoice.</div>
        </div>
      </div>
    </main>
  );
}
