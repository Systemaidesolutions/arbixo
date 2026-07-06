import { prisma } from "@/lib/prisma";
import { setAuditSuppressed } from "@/lib/auditContext";
import type { SubscriptionPrice } from "@prisma/client";

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

/** The price in effect today (most recent one whose window covers now). */
export async function getCurrentPrice(now: Date = new Date()): Promise<SubscriptionPrice | null> {
  return prisma.subscriptionPrice.findFirst({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function listPrices(): Promise<SubscriptionPrice[]> {
  return prisma.subscriptionPrice.findMany({ orderBy: { effectiveFrom: "desc" } });
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
}): Promise<SubscriptionPrice> {
  const from = new Date(input.effectiveFrom);
  const dayBefore = new Date(from.getTime() - 24 * 60 * 60 * 1000);

  // Suppress auto-audit: the extension's out-of-band write deadlocks the
  // transaction on the connection-limited production pooler.
  setAuditSuppressed(true);
  try {
    return await prisma.$transaction(async (tx) => {
      const open = await tx.subscriptionPrice.findMany({ where: { effectiveTo: null } });
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
        },
      });
    });
  } finally {
    setAuditSuppressed(false);
  }
}
