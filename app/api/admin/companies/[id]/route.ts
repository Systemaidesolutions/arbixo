import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { validateCompanyPayload, type CompanyFormPayload } from "@/lib/company";
import { invalidateAuditCache } from "@/lib/auditSettings";
import { deleteCompany } from "@/lib/deleteCompany";
import { getCurrentPrice } from "@/lib/subscriptionPricing";
import { monthStringToPeriod, recomputeCompanySubscriptionSummary } from "@/lib/subscriptionCoverage";
import { setAuditSuppressed } from "@/lib/auditContext";
import type { Prisma } from "@prisma/client";

// Permanently delete a company and all of its data. Admin-only; the UI gates
// this behind two confirmations.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  await deleteCompany(params.id);
  return NextResponse.json({ ok: true });
}

type SettingsPayload = {
  auditLogEnabled?: boolean;
  isActive?: boolean;
  billingEmail?: string | null;
  logoUrl?: string | null;
  subscriptionStartedAt?: string | null;
  subscriptionEndsAt?: string | null;
  renewMonth?: string; // "YYYY-MM" — records a payment for that specific month
  cancelSubscription?: boolean;
};

const SETTINGS_KEYS: (keyof SettingsPayload)[] = [
  "auditLogEnabled",
  "isActive",
  "billingEmail",
  "logoUrl",
  "subscriptionStartedAt",
  "subscriptionEndsAt",
  "renewMonth",
  "cancelSubscription",
];

// Admin edits an existing company. Subscribers get a read-only view of
// their own company; all edits go through here. A body containing any
// "settings" key is treated as a settings update (audit toggle, account
// status, subscription); otherwise it's the full company form.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = (await request.json().catch(() => null)) as
    | (Partial<CompanyFormPayload> & SettingsPayload)
    | null;
  if (!raw) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const isSettings = SETTINGS_KEYS.some((k) => k in raw);
  if (isSettings) {
    const existing = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Renew for a specific month: its own action, recording a real
    // SubscriptionPayment (closing the gap where this route used to move
    // subscriptionEndsAt around with no payment trail at all) rather than
    // bundling with the other settings fields below.
    if (raw.renewMonth) {
      let periodStart: Date, periodEnd: Date;
      try {
        ({ periodStart, periodEnd } = monthStringToPeriod(raw.renewMonth));
      } catch {
        return NextResponse.json({ error: "A valid month (YYYY-MM) is required." }, { status: 400 });
      }
      const price = await getCurrentPrice();
      if (!price) return NextResponse.json({ error: "No subscription price is set." }, { status: 400 });

      setAuditSuppressed(true);
      try {
        await prisma.subscriptionPayment.create({
          data: {
            companyId: params.id,
            priceName: price.name,
            baseAmount: price.amount,
            currency: price.currency,
            discountAmount: 0,
            amountDue: price.amount,
            status: "VERIFIED",
            createdById: admin.id,
            createdByEmail: admin.email,
            verifiedById: admin.id,
            verifiedAt: new Date(),
            periodStart,
            periodEnd,
          },
        });
        await recomputeCompanySubscriptionSummary(params.id);
      } finally {
        setAuditSuppressed(false);
      }
      const company = await prisma.company.findUnique({ where: { id: params.id } });
      return NextResponse.json({
        ok: true,
        company: {
          isActive: company!.isActive,
          auditLogEnabled: company!.auditLogEnabled,
          billingEmail: company!.billingEmail,
          subscriptionStartedAt: company!.subscriptionStartedAt,
          subscriptionEndsAt: company!.subscriptionEndsAt,
        },
      });
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (typeof raw.auditLogEnabled === "boolean") data.auditLogEnabled = raw.auditLogEnabled;
    if (typeof raw.isActive === "boolean") data.isActive = raw.isActive;
    if ("billingEmail" in raw) data.billingEmail = raw.billingEmail?.trim() || null;
    if ("logoUrl" in raw) data.logoUrl = raw.logoUrl?.trim() || null;
    if ("subscriptionStartedAt" in raw) {
      data.subscriptionStartedAt = raw.subscriptionStartedAt ? new Date(raw.subscriptionStartedAt) : null;
    }
    if ("subscriptionEndsAt" in raw) {
      data.subscriptionEndsAt = raw.subscriptionEndsAt ? new Date(raw.subscriptionEndsAt) : null;
      data.subscriptionReminderSentAt = null; // new period -> reminder can fire again
    }
    // Cancel: clear the subscription entirely (company then has none).
    if (raw.cancelSubscription === true) {
      data.subscriptionEndsAt = null;
      data.subscriptionStartedAt = null;
      data.subscriptionReminderSentAt = null;
    }

    const company = await prisma.company.update({ where: { id: params.id }, data });
    if (typeof raw.auditLogEnabled === "boolean") invalidateAuditCache(params.id);
    return NextResponse.json({
      ok: true,
      company: {
        isActive: company.isActive,
        auditLogEnabled: company.auditLogEnabled,
        billingEmail: company.billingEmail,
        subscriptionStartedAt: company.subscriptionStartedAt,
        subscriptionEndsAt: company.subscriptionEndsAt,
      },
    });
  }

  const body = raw as CompanyFormPayload;
  const validationError = validateCompanyPayload(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const existing = await prisma.company.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const company = await prisma.company.update({ where: { id: params.id }, data: body });
  return NextResponse.json({ company });
}
