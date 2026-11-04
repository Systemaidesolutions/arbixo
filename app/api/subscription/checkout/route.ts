import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveCompanyId, getCurrentCapability } from "@/lib/currentUser";
import { getCurrentPayrollPrices, getCurrentPrice } from "@/lib/subscriptionPricing";
import { activePayrollEmployees, getPayrollCoverage } from "@/lib/payroll/subscription";

// Data the renew flow needs: current price, the GCash account, and the
// company's current subscription end. Manager-only (or an admin acting
// inside the company — see lib/adminActingAs.ts).
export async function GET() {
  const companyId = await effectiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company." }, { status: 403 });
  }
  const cap = await getCurrentCapability();
  if (!cap?.canApprove) {
    return NextResponse.json({ error: "Only a Manager can renew the subscription." }, { status: 403 });
  }

  const [payrollPrices, payrollCoverage, payrollEmployees] = await Promise.all([
    getCurrentPayrollPrices(),
    getPayrollCoverage(companyId),
    activePayrollEmployees(companyId),
  ]);
  const [price, settings, company] = await Promise.all([
    getCurrentPrice(),
    prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { gcashName: true, gcashNumber: true, gcashQrImage: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { subscriptionEndsAt: true } }),
  ]);

  return NextResponse.json({
    price: price
      ? { name: price.name, amount: Number(price.amount), currency: price.currency }
      : null,
    gcash: { name: settings?.gcashName ?? "", number: settings?.gcashNumber ?? "", qrImage: settings?.gcashQrImage ?? null },
    subscriptionEndsAt: company?.subscriptionEndsAt ?? null,
    payroll: {
      prices: payrollPrices.map((p) => ({ maxEmployees: p.maxEmployees!, name: p.name, amount: Number(p.amount), currency: p.currency })),
      // "YYYY-MM" → employee tier already paid
      paidMonths: Object.fromEntries(
        [...payrollCoverage].map(([k, tier]) => [`${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`, tier]),
      ),
      activeEmployees: payrollEmployees,
    },
  });
}
