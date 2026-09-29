import { prisma } from "@/lib/prisma";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type OpenBill = {
  documentNo: string;
  postingDate: Date;
  referenceNo: string | null;
  amount: number;
  applied: number;
  openBalance: number;
  // The invoice's own VAT-exclusive total — the sum of netAmount across its
  // expense lines (not the AP line itself, which carries no VAT split).
  // Lets a Cash Disbursement line that settles this bill compute its
  // withholding base from what was ACTUALLY taxed at posting time, instead
  // of re-guessing a VAT type when the payment is entered. Falls back to
  // the full gross if, for some reason, no expense lines were found.
  netOfVat: number;
};

/**
 * A vendor's posted Purchase on Account bills that still have an unpaid
 * balance — amount minus whatever's already been recorded against them via
 * PayableApplication. Only real bills (not credit memos, which adjust a
 * vendor's overall balance but aren't something a payment "applies to"
 * here) and not cancelled. Mirrors getOpenInvoicesForCustomer for AR.
 */
export async function getOpenBillsForVendor(companyId: string, vendorId: string): Promise<OpenBill[]> {
  const [apLines, applied] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        vendorId,
        journalType: "PURCHASE_ON_ACCOUNT",
        documentType: "PURCHASE",
        isCancelled: false,
        account: { classification: "ACCOUNTS_PAYABLE" },
      },
      orderBy: { postingDate: "asc" },
    }),
    prisma.payableApplication.groupBy({
      by: ["invoiceDocumentNo"],
      where: { companyId, vendorId },
      _sum: { amountApplied: true },
    }),
  ]);

  const appliedByDoc = new Map(applied.map((a) => [a.invoiceDocumentNo, Number(a._sum.amountApplied ?? 0)]));

  const docNos = apLines.map((e) => e.documentNo);
  const expenseLines = docNos.length
    ? await prisma.ledgerEntry.findMany({
        where: { companyId, journalType: "PURCHASE_ON_ACCOUNT", documentNo: { in: docNos }, isCancelled: false },
        select: { documentNo: true, netAmount: true, account: { select: { classification: true } } },
      })
    : [];
  const netOfVatByDoc = new Map<string, number>();
  for (const l of expenseLines) {
    if (l.account.classification === "ACCOUNTS_PAYABLE") continue; // the balancing line itself — no VAT split
    netOfVatByDoc.set(l.documentNo, (netOfVatByDoc.get(l.documentNo) ?? 0) + Number(l.netAmount ?? 0));
  }

  return apLines
    .map((e) => {
      const amount = Number(e.creditAmount);
      const appliedAmt = round2(appliedByDoc.get(e.documentNo) ?? 0);
      return {
        documentNo: e.documentNo,
        postingDate: e.postingDate,
        referenceNo: e.referenceNo,
        amount,
        applied: appliedAmt,
        openBalance: round2(amount - appliedAmt),
        netOfVat: round2(netOfVatByDoc.get(e.documentNo) ?? amount),
      };
    })
    .filter((bill) => bill.openBalance > 0.005);
}

export class ApplicationOverLimitError extends Error {}
export class ApplicationMismatchError extends Error {}

export type ApplicationInput = { invoiceDocumentNo: string; amount: number };

/**
 * Guards against applying more (or less) to bills than the disbursement's own
 * Accounts Payable line(s) actually total — mirrors assertApplicationsMatchArLines.
 * Called before the document is posted, so a mismatch blocks the whole
 * disbursement rather than leaving a partial mess.
 */
export async function assertApplicationsMatchApLines(
  apLineTotal: number,
  applications: ApplicationInput[]
): Promise<void> {
  if (applications.length === 0) return;
  const appliedTotal = round2(applications.reduce((s, a) => s + a.amount, 0));
  if (appliedTotal !== round2(apLineTotal)) {
    throw new ApplicationMismatchError(
      `The amount applied to bills (${appliedTotal}) doesn't match the Accounts Payable line total (${apLineTotal}).`
    );
  }
}

/**
 * Records which bills a just-posted Cash Disbursement paid off. Re-checks
 * each bill's open balance at write time (not just what the client showed)
 * since another payment could have applied against the same bill in the
 * meantime — throws rather than silently over-applying.
 */
export async function recordPayableApplications(
  companyId: string,
  vendorId: string,
  paymentDocumentNo: string,
  applications: ApplicationInput[],
  createdById?: string
): Promise<void> {
  const valid = applications.filter((a) => a.invoiceDocumentNo && a.amount > 0);
  if (valid.length === 0) return;

  const open = await getOpenBillsForVendor(companyId, vendorId);
  const openByDoc = new Map(open.map((o) => [o.documentNo, o.openBalance]));

  for (const a of valid) {
    const openBalance = openByDoc.get(a.invoiceDocumentNo) ?? 0;
    if (round2(a.amount) > openBalance + 0.005) {
      throw new ApplicationOverLimitError(
        `Applied amount for bill ${a.invoiceDocumentNo} exceeds its open balance.`
      );
    }
  }

  await prisma.payableApplication.createMany({
    data: valid.map((a) => ({
      companyId,
      vendorId,
      paymentDocumentNo,
      invoiceDocumentNo: a.invoiceDocumentNo,
      amountApplied: round2(a.amount),
      createdById: createdById ?? null,
    })),
  });
}
