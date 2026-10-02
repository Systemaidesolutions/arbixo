import { prisma } from "@/lib/prisma";

export type BusinessProfile = {
  registeredName: string;
  tradeName: string;
  tin: string;
  taxpayerClass: string;
  address: string;
  rdoCode: string;
  periodType: string;
  registrationType: string;
  businessType: string;
  lineOfBusiness: string;
  telephone: string;
  atpNumber: string;
  atpSeriesFrom: string;
  atpSeriesTo: string;
  atpValidUntil: string | null;
};

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return {
    registeredName: s?.bizRegisteredName ?? "",
    tradeName: s?.bizTradeName ?? "",
    tin: s?.bizTin ?? "",
    taxpayerClass: s?.bizTaxpayerClass ?? "",
    address: s?.bizAddress ?? "",
    rdoCode: s?.bizRdoCode ?? "",
    periodType: s?.bizPeriodType ?? "",
    registrationType: s?.bizRegistrationType ?? "",
    businessType: s?.bizBusinessType ?? "",
    lineOfBusiness: s?.bizLineOfBusiness ?? "",
    telephone: s?.bizTelephone ?? "",
    atpNumber: s?.atpNumber ?? "",
    atpSeriesFrom: s?.atpSeriesFrom ?? "",
    atpSeriesTo: s?.atpSeriesTo ?? "",
    atpValidUntil: s?.atpValidUntil ? s.atpValidUntil.toISOString() : null,
  };
}

function formatInvoiceNo(n: number): string {
  return `INV-${String(n).padStart(6, "0")}`;
}

// Atomically claims the next invoice number — a single UPDATE statement
// (not wrapped in a $transaction), consistent with the rest of the verify
// flow avoiding multi-statement transactions on the connection-pooled prod
// database (see audit-extension-tx-deadlock memory).
export async function issueInvoiceNumber(): Promise<string> {
  const updated = await prisma.appSettings.update({
    where: { id: "singleton" },
    data: { nextInvoiceNo: { increment: 1 } },
    select: { nextInvoiceNo: true },
  });
  return formatInvoiceNo(updated.nextInvoiceNo - 1);
}

export type VatBreakdown = {
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  vatAmount: number;
  totalSales: number;
  lessDiscount: number;
  totalAmountDue: number;
};

// ARbixo is VAT-registered and the subscription price shown/collected is
// VAT-inclusive (what the subscriber actually pays), so VAT is backed out
// of amountDue rather than added on top. discountAmount (voucher) is
// assumed applied before VAT computation, consistent with amountDue already
// being baseAmount - discountAmount.
export function computeVatBreakdown(amountDue: number, discountAmount: number): VatBreakdown {
  const vatableSales = amountDue / 1.12;
  const vatAmount = amountDue - vatableSales;
  return {
    vatableSales,
    vatExemptSales: 0,
    zeroRatedSales: 0,
    vatAmount,
    totalSales: vatableSales,
    lessDiscount: discountAmount,
    totalAmountDue: amountDue,
  };
}

// "August 2026" for a single-month payment, or "January - July 2026" for a
// multi-month span. Mirrors the monthLabel helper in PaymentsClient.tsx.
export function invoicePeriodLabel(periodStart: Date | null, periodEnd: Date | null): string {
  if (!periodStart) return "—";
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  if (!periodEnd) return fmt(periodStart);
  const lastCoveredMonth = new Date(periodEnd.getTime() - 1);
  const startLabel = fmt(periodStart);
  const endLabel = fmt(lastCoveredMonth);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}
