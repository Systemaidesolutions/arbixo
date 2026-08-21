import { prisma } from "@/lib/prisma";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type OpenInvoice = {
  documentNo: string;
  postingDate: Date;
  referenceNo: string | null;
  amount: number;
  applied: number;
  openBalance: number;
};

/**
 * A customer's posted Sales on Account invoices that still have an unpaid
 * balance — amount minus whatever's already been recorded against them via
 * ReceivableApplication. Only real invoices (not credit memos, which adjust
 * a customer's overall balance but aren't something a payment "applies
 * to" here) and not cancelled.
 */
export async function getOpenInvoicesForCustomer(companyId: string, customerId: string): Promise<OpenInvoice[]> {
  const [arLines, applied] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        customerId,
        journalType: "SALES_ON_ACCOUNT",
        documentType: "INVOICE",
        isCancelled: false,
        account: { classification: "ACCOUNTS_RECEIVABLE" },
      },
      orderBy: { postingDate: "asc" },
    }),
    prisma.receivableApplication.groupBy({
      by: ["invoiceDocumentNo"],
      where: { companyId, customerId },
      _sum: { amountApplied: true },
    }),
  ]);

  const appliedByDoc = new Map(applied.map((a) => [a.invoiceDocumentNo, Number(a._sum.amountApplied ?? 0)]));

  return arLines
    .map((e) => {
      const amount = Number(e.debitAmount);
      const appliedAmt = round2(appliedByDoc.get(e.documentNo) ?? 0);
      return {
        documentNo: e.documentNo,
        postingDate: e.postingDate,
        referenceNo: e.referenceNo,
        amount,
        applied: appliedAmt,
        openBalance: round2(amount - appliedAmt),
      };
    })
    .filter((inv) => inv.openBalance > 0.005);
}

export class ApplicationOverLimitError extends Error {}

export type ApplicationInput = { invoiceDocumentNo: string; amount: number };

/**
 * Records which invoices a just-posted Cash Receipt paid off. Re-checks each
 * invoice's open balance at write time (not just what the client showed)
 * since another payment could have applied against the same invoice in the
 * meantime — throws rather than silently over-applying.
 */
export async function recordReceivableApplications(
  companyId: string,
  customerId: string,
  paymentDocumentNo: string,
  applications: ApplicationInput[],
  createdById?: string
): Promise<void> {
  const valid = applications.filter((a) => a.invoiceDocumentNo && a.amount > 0);
  if (valid.length === 0) return;

  const open = await getOpenInvoicesForCustomer(companyId, customerId);
  const openByDoc = new Map(open.map((o) => [o.documentNo, o.openBalance]));

  for (const a of valid) {
    const openBalance = openByDoc.get(a.invoiceDocumentNo) ?? 0;
    if (round2(a.amount) > openBalance + 0.005) {
      throw new ApplicationOverLimitError(
        `Applied amount for invoice ${a.invoiceDocumentNo} exceeds its open balance.`
      );
    }
  }

  await prisma.receivableApplication.createMany({
    data: valid.map((a) => ({
      companyId,
      customerId,
      paymentDocumentNo,
      invoiceDocumentNo: a.invoiceDocumentNo,
      amountApplied: round2(a.amount),
      createdById: createdById ?? null,
    })),
  });
}
