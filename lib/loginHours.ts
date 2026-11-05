// Company allowed-login hours, in Philippine time (UTC+8, no DST). Outside
// them, the company's users must sign in with two-factor authentication.
// Pure, so it can be unit-tested.

export type LoginHours = {
  loginHoursEnabled: boolean;
  loginStart: string; // "HH:MM", 24-hour
  loginEnd: string; // "HH:MM"; earlier than start = crosses midnight
  loginDays: number[]; // 0 = Sunday … 6 = Saturday
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

export function isValidHHMM(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Day of week (0–6) and minute of day in Philippine time. */
export function phClock(at: Date): { day: number; minute: number } {
  const ph = new Date(at.getTime() + PH_OFFSET_MS);
  return { day: ph.getUTCDay(), minute: ph.getUTCHours() * 60 + ph.getUTCMinutes() };
}

/**
 * True when signing in at `at` is inside the allowed hours (or the
 * restriction is off). For a window that crosses midnight, e.g. 22:00–06:00,
 * the early-morning part counts toward the day the window started.
 */
export function isWithinLoginHours(h: LoginHours, at: Date = new Date()): boolean {
  if (!h.loginHoursEnabled) return true;
  if (!isValidHHMM(h.loginStart) || !isValidHHMM(h.loginEnd)) return true;
  const { day, minute } = phClock(at);
  const start = minutes(h.loginStart);
  const end = minutes(h.loginEnd);
  const days = new Set(h.loginDays);
  if (start === end) return days.has(day); // whole day
  if (start < end) return days.has(day) && minute >= start && minute < end;
  // Crosses midnight.
  if (minute >= start) return days.has(day);
  if (minute < end) return days.has((day + 6) % 7);
  return false;
}

/** "Mon–Sat, 8:00 AM – 8:00 PM" style summary for messages and the admin page. */
export function describeLoginHours(h: LoginHours): string {
  const fmt = (hhmm: string) => {
    const [hh, mm] = hhmm.split(":").map(Number);
    const ampm = hh < 12 ? "AM" : "PM";
    return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${ampm}`;
  };
  const days = [...h.loginDays].sort((a, b) => a - b);
  const contiguous = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText =
    days.length === 7
      ? "Every day"
      : days.length === 0
        ? "No days"
        : contiguous
          ? `${DAY_LABELS[days[0]]}–${DAY_LABELS[days[days.length - 1]]}`
          : days.map((d) => DAY_LABELS[d]).join(", ");
  const time = h.loginStart === h.loginEnd ? "all day" : `${fmt(h.loginStart)} – ${fmt(h.loginEnd)}`;
  return `${dayText}, ${time} (PH time)`;
}
