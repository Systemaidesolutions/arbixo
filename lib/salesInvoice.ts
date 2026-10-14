import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function formatInvoiceNo(n: number): string {
  return `INV-${String(n).padStart(6, "0")}`;
}

// Atomically claims a company's next e-invoice number — a single UPDATE
// statement. Mirrors lib/subscriptionInvoice.ts's issueInvoiceNumber, scoped
// per company instead of the one global AppSettings counter.
export async function issueSalesInvoiceNumber(
  companyId: string,
  client: Pick<typeof prisma, "company"> | Prisma.TransactionClient = prisma
): Promise<string> {
  const updated = await client.company.update({
    where: { id: companyId },
    data: { nextInvoiceNo: { increment: 1 } },
    select: { nextInvoiceNo: true },
  });
  return formatInvoiceNo(updated.nextInvoiceNo - 1);
}

export type SalesInvoiceResult = { invoiceNo: string; issuedAt: Date; alreadyExisted: boolean };

// Idempotent: returns the existing invoice for this document if one was
// already generated, otherwise claims a new number and records it.
export async function getOrCreateSalesInvoice(
  companyId: string,
  documentNo: string,
  createdById: string | null
): Promise<SalesInvoiceResult> {
  const existing = await prisma.salesInvoice.findUnique({ where: { companyId_documentNo: { companyId, documentNo } } });
  if (existing) return { invoiceNo: existing.invoiceNo, issuedAt: existing.issuedAt, alreadyExisted: true };

  const invoiceNo = await issueSalesInvoiceNumber(companyId);
  const created = await prisma.salesInvoice.create({
    data: { companyId, documentNo, invoiceNo, createdById },
  });
  return { invoiceNo: created.invoiceNo, issuedAt: created.issuedAt, alreadyExisted: false };
}

export type DocumentVatBreakdown = {
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  vatAmount: number;
  totalSales: number;
  totalAmountDue: number;
};

// Sums a posted Sales on Account document's own lines by VAT type — unlike
// the subscription invoice (always one flat VAT_12 amount), a real Sales
// document can mix VATable/exempt/zero-rated lines.
export function computeDocumentVatBreakdown(
  lines: { vatType: string | null; netAmount: Prisma.Decimal | number | string | null; vatAmount: Prisma.Decimal | number | string | null }[]
): DocumentVatBreakdown {
  let vatableSales = 0;
  let vatExemptSales = 0;
  let zeroRatedSales = 0;
  let vatAmount = 0;
  for (const l of lines) {
    const net = Number(l.netAmount ?? 0);
    const vat = Number(l.vatAmount ?? 0);
    if (l.vatType === "VAT_12") {
      vatableSales += net;
      vatAmount += vat;
    } else if (l.vatType === "ZERO_RATED") {
      zeroRatedSales += net;
    } else {
      // VAT_EXEMPT, NON_VAT, or untagged — no VAT charged either way, so
      // these all land in the same "no VAT" bucket. Without this, a line
      // with vatType other than the three BIR categories above silently
      // contributed to neither total, leaving Total Amount Due understating
      // the actual particulars total.
      vatExemptSales += net;
    }
  }
  const totalSales = vatableSales + vatExemptSales + zeroRatedSales;
  return { vatableSales, vatExemptSales, zeroRatedSales, vatAmount, totalSales, totalAmountDue: totalSales + vatAmount };
}
