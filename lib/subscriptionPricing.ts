import { prisma } from "@/lib/prisma";
import { setAuditSuppressed } from "@/lib/auditContext";
import type { SubscriptionApp, SubscriptionPrice } from "@prisma/client";
import { isPayrollTier } from "@/lib/payroll/subscriptionTiers";

export type PriceStatus = "current" | "upcoming" | "expired";

// A price's status is derived purely from its dates: "current" when today falls
// in [effectiveFrom, effectiveTo|∞], "upcoming" if it starts later, "expired"
// if its window has passed.
export function priceStatus(p: Pick<SubscriptionPrice, "effectiveFrom" | "effectiveTo">, now: Date = new Date()): PriceStatus {
  const from = new Date(p.effectiveFrom).getTime();
  const to = p.effectiveTo ? new Date(p.effectiveTo).getTime() : null;
  if (from > now.getTime()) return "upcoming";
  if (to !== null && to < now.getTime()) return "expired";
  return "current";
}

/** The price in effect today (most recent one whose window covers now) for an app (and payroll employee tier). */
export async function getCurrentPrice(
  now: Date = new Date(),
  app: SubscriptionApp = "ACCOUNTING",
  maxEmployees: number | null = null,
): Promise<SubscriptionPrice | null> {
  return prisma.subscriptionPrice.findFirst({
    where: {
      app,
      ...(app === "PAYROLL" ? { maxEmployees } : {}),
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function listPrices(): Promise<SubscriptionPrice[]> {
  return prisma.subscriptionPrice.findMany({ orderBy: [{ app: "asc" }, { maxEmployees: "asc" }, { effectiveFrom: "desc" }] });
}

/** The current ARbixo Payroll price of every tier that has one, smallest tier first. */
export async function getCurrentPayrollPrices(now: Date = new Date()): Promise<SubscriptionPrice[]> {
  const rows = await prisma.subscriptionPrice.findMany({
    where: { app: "PAYROLL", maxEmployees: { not: null }, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
    orderBy: [{ maxEmployees: "asc" }, { effectiveFrom: "desc" }],
  });
  const seen = new Set<number>();
  return rows.filter((r) => !seen.has(r.maxEmployees!) && seen.add(r.maxEmployees!));
}

/**
 * Adds a new price and closes the previously open-ended one (BC-style): any
 * open price starting before the new one gets its effectiveTo set to the day
 * before the new price starts, so the new price becomes current and the old one
 * reads as expired — all derivable from dates.
 */
export async function addPrice(input: {
  name: string;
  amount: number;
  currency?: string;
  effectiveFrom: Date;
  app?: SubscriptionApp;
  maxEmployees?: number | null;
}): Promise<SubscriptionPrice> {
  const app = input.app ?? "ACCOUNTING";
  const maxEmployees = app === "PAYROLL" ? input.maxEmployees ?? null : null;
  const from = new Date(input.effectiveFrom);
  const dayBefore = new Date(from.getTime() - 24 * 60 * 60 * 1000);

  // Suppress auto-audit: the extension's out-of-band write deadlocks the
  // transaction on the connection-limited production pooler.
  setAuditSuppressed(true);
  try {
    return await prisma.$transaction(async (tx) => {
      // Only the same app (and payroll tier) is closed — each has its own chain.
      const open = await tx.subscriptionPrice.findMany({ where: { effectiveTo: null, app, maxEmployees } });
      for (const p of open) {
        if (new Date(p.effectiveFrom).getTime() < from.getTime()) {
          await tx.subscriptionPrice.update({ where: { id: p.id }, data: { effectiveTo: dayBefore } });
        }
      }
      return tx.subscriptionPrice.create({
        data: {
          name: input.name.trim(),
          amount: input.amount,
          currency: (input.currency || "PHP").trim(),
          effectiveFrom: from,
          app,
          maxEmployees,
        },
      });
    });
  } finally {
    setAuditSuppressed(false);
  }
}

/**
 * Reads { app, maxEmployees } from a renew/pay request body and finds the
 * current price for it. ACCOUNTING is the default; PAYROLL needs a valid
 * employee tier (20, 50, 100, 200 …) that has a current price.
 */
export async function priceForRequest(body: unknown): Promise<
  | { ok: true; price: SubscriptionPrice; app: SubscriptionApp; maxEmployees: number | null; priceName: string }
  | { ok: false; error: string }
> {
  const b = (body ?? {}) as { app?: unknown; maxEmployees?: unknown };
  const app: SubscriptionApp = b.app === "PAYROLL" ? "PAYROLL" : "ACCOUNTING";
  if (app === "ACCOUNTING") {
    const price = await getCurrentPrice();
    if (!price) return { ok: false, error: "No subscription price is set. Contact your administrator." };
    return { ok: true, price, app, maxEmployees: null, priceName: price.name };
  }
  const tier = Number(b.maxEmployees);
  if (!isPayrollTier(tier)) return { ok: false, error: "Pick an employee tier for ARbixo Payroll." };
  const price = await getCurrentPrice(new Date(), "PAYROLL", tier);
  if (!price) return { ok: false, error: `No ARbixo Payroll price is set for up to ${tier} employees. Contact your administrator.` };
  return { ok: true, price, app, maxEmployees: tier, priceName: `Payroll, up to ${tier} employees (${price.name})` };
}
