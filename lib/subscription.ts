export type SubscriptionState = "none" | "active" | "expiring" | "expired";

export const RENEW_WINDOW_DAYS = 7;

/**
 * Derives a company's subscription state from its end date. "expiring"
 * means within the renew window (7 days); "expired" means past. Note this
 * is informational only — an expired subscription never blocks sign-in
 * (that's the separate company isActive flag).
 */
export function subscriptionStatus(
  endsAt: Date | string | null | undefined,
  now: Date = new Date()
): { state: SubscriptionState; daysLeft: number | null } {
  if (!endsAt) return { state: "none", daysLeft: null };
  const end = new Date(endsAt).getTime();
  const daysLeft = Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLeft < 0) return { state: "expired", daysLeft };
  if (daysLeft <= RENEW_WINDOW_DAYS) return { state: "expiring", daysLeft };
  return { state: "active", daysLeft };
}

/** True when the company currently has a paid, non-expired subscription. */
export function hasActiveSubscription(
  endsAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  return !!endsAt && new Date(endsAt).getTime() >= now.getTime();
}

/** yyyy-mm-dd for <input type="date"> / display. */
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}
