// Night-time login alert: a sign-in between 8:00 PM and 3:59 AM Philippine
// time (UTC+8, no daylight saving) emails every admin. Pure helpers here so
// the time window is unit-tested; the send lives in lib/mail.ts.

export const NIGHT_START_HOUR = 20; // 8:00 PM
export const NIGHT_END_HOUR = 4; // up to, not including, 4:00 AM

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Hour of day (0–23) in Philippine time. */
export function phHour(at: Date): number {
  return new Date(at.getTime() + PH_OFFSET_MS).getUTCHours();
}

/** True for 8:00 PM–3:59 AM Philippine time. */
export function isNightLoginPH(at: Date): boolean {
  const h = phHour(at);
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

/** e.g. "Nov 5, 2026, 11:42:07 PM" in Philippine time. */
export function formatPH(at: Date): string {
  return at.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
