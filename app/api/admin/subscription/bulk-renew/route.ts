import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { monthStringToPeriod, recomputeCompanySubscriptionSummary } from "@/lib/subscriptionCoverage";

// Admin marks one calendar month as covered for every company at once, as a
// $0 administrative grant (not a real payment — for platform-wide grants or
// promotions; use the per-company renew for recording an actual GCash
// payment). Runs one company at a time rather than a single giant
// transaction, since the company count isn't bounded and a huge batch could
// hold the pooler's one transaction connection open too long.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const month = typeof body?.month === "string" ? body.month : "";
  let periodStart: Date, periodEnd: Date;
  try {
    ({ periodStart, periodEnd } = monthStringToPeriod(month));
  } catch {
    return NextResponse.json({ error: "A valid month (YYYY-MM) is required." }, { status: 400 });
  }

  const companies = await prisma.company.findMany({ select: { id: true } });
  const now = new Date();

  setAuditSuppressed(true);
  let updated = 0;
  try {
    for (const c of companies) {
      await prisma.subscriptionPayment.create({
        data: {
          companyId: c.id,
          priceName: "Admin bulk grant",
          baseAmount: 0,
          currency: "PHP",
          discountAmount: 0,
          amountDue: 0,
          status: "VERIFIED",
          createdById: admin.id,
          createdByEmail: admin.email,
          verifiedById: admin.id,
          verifiedAt: now,
          periodStart,
          periodEnd,
        },
      });
      await recomputeCompanySubscriptionSummary(c.id);
      updated++;
    }
    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    console.error("[admin bulk renew] failed:", err);
    return NextResponse.json({ error: "Could not apply to all companies.", updated }, { status: 500 });
  } finally {
    setAuditSuppressed(false);
  }
}
