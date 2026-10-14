import { prisma } from "@/lib/prisma";
import { postVatJournal } from "@/lib/vatJournals";
import { invoicePeriodLabel } from "@/lib/subscriptionInvoice";
import type { TaxClassification, RegistrationType } from "@prisma/client";

export type ArbixoPostResult =
  | { ok: true; documentNo: string }
  | { ok: false; reason: string };

// Posts a verified subscription payment into ARbixo's OWN books (the real
// Company row for Systemaide Solutions Inc., a subscriber of its own app) as
// a Sales on Account entry — so its subscription revenue shows up in its own
// General Ledger / reports, not just as a standalone SubscriptionPayment row
// and a printed invoice. Best-effort: never throws, so a misconfiguration or
// posting error here never blocks verifying the subscriber's payment.
export async function postSubscriptionPaymentToArbixoBooks(
  payment: {
    id: string;
    companyId: string;
    priceName: string;
    amountDue: unknown;
    invoiceNo: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  },
  actorUserId: string
): Promise<ArbixoPostResult> {
  const amountDue = Number(payment.amountDue);
  if (amountDue <= 0) return { ok: false, reason: "no amount due" };
  if (!payment.invoiceNo) return { ok: false, reason: "no invoice number" };

  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.arbixoCompanyId || !settings.arbixoReceivableAccountId || !settings.arbixoRevenueAccountId) {
    return { ok: false, reason: "ARbixo bookkeeping sync isn't configured (Business profile settings)" };
  }
  // A subscriber's own payment for ARbixo itself (if ARbixo ever subscribes
  // to itself for testing) would try to post into its own books as its own
  // customer — skip rather than create a nonsensical self-referencing entry.
  if (payment.companyId === settings.arbixoCompanyId) return { ok: false, reason: "payer is ARbixo itself" };

  const subscriber = await prisma.company.findUnique({ where: { id: payment.companyId } });
  if (!subscriber) return { ok: false, reason: "subscriber company not found" };

  try {
    const customerId = await findOrCreateArbixoCustomer(settings.arbixoCompanyId, subscriber);
    const periodLabel = invoicePeriodLabel(payment.periodStart, payment.periodEnd);
    const description = `ARbixo subscription — ${payment.priceName} — ${periodLabel}`;

    await postVatJournal(
      settings.arbixoCompanyId,
      "SALES_ON_ACCOUNT",
      {
        documentNo: payment.invoiceNo,
        postingDate: new Date(),
        counterpartyType: "CUSTOMER",
        counterpartyId: customerId,
        balancingAccountId: settings.arbixoReceivableAccountId,
        particulars: description,
        lines: [
          {
            accountId: settings.arbixoRevenueAccountId,
            amount: amountDue,
            amountIsGross: true,
            vatType: "VAT_12",
            lineDescription: description,
          },
        ],
      },
      actorUserId,
      // This is an internal bookkeeping sync, not a user-initiated
      // transaction — ARbixo's own subscription status (to itself) is
      // irrelevant to recording its own revenue.
      { skipSubscriptionCheck: true }
    );

    await prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { arbixoDocumentNo: payment.invoiceNo } });
    return { ok: true, documentNo: payment.invoiceNo };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "unknown error" };
  }
}

async function findOrCreateArbixoCustomer(
  arbixoCompanyId: string,
  subscriber: { id: string; billingCustomerId: string | null; tin: string; taxClassification: TaxClassification; registeredName: string | null; tradeName: string; registrationType: RegistrationType; businessAddress: string; barangay: string | null; district: string | null; city: string | null; province: string | null; zipCode: string }
): Promise<string> {
  if (subscriber.billingCustomerId) {
    const existing = await prisma.customer.findUnique({ where: { id: subscriber.billingCustomerId } });
    if (existing && existing.companyId === arbixoCompanyId) return existing.id;
  }

  const byTin = subscriber.tin
    ? await prisma.customer.findFirst({ where: { companyId: arbixoCompanyId, tin: subscriber.tin } })
    : null;
  if (byTin) {
    await prisma.company.update({ where: { id: subscriber.id }, data: { billingCustomerId: byTin.id } });
    return byTin.id;
  }

  const count = await prisma.customer.count({ where: { companyId: arbixoCompanyId } });
  const created = await prisma.customer.create({
    data: {
      companyId: arbixoCompanyId,
      code: `SUB-${String(count + 1).padStart(4, "0")}`,
      tin: subscriber.tin || null,
      taxClassification: subscriber.taxClassification,
      registeredName: subscriber.registeredName,
      tradeName: subscriber.tradeName,
      customerType: "PRIVATE",
      registrationType: subscriber.registrationType,
      address: subscriber.businessAddress,
      barangay: subscriber.barangay,
      district: subscriber.district,
      city: subscriber.city,
      province: subscriber.province,
      zipCode: subscriber.zipCode,
    },
  });
  await prisma.company.update({ where: { id: subscriber.id }, data: { billingCustomerId: created.id } });
  return created.id;
}
