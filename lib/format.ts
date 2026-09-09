/** Formats a number with thousands separators and 2 decimals: 1,234.56 (no currency symbol). */
export function formatPeso(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formats a full (day-level) date as MM/DD/YYYY — the app-wide standard. */
export function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** MM/DD/YYYY from a plain "YYYY-MM-DD" string — avoids Date/timezone parsing for `<input type="date">` values. */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/** Report coverage caption from optional "YYYY-MM-DD" date-range bounds, e.g. "All Dates", "From 01/01/2026", "01/01/2026 to 12/31/2026". */
export function formatDateRangeCoverage(dateFrom?: string | null, dateTo?: string | null): string {
  if (dateFrom && dateTo) return `${formatIsoDate(dateFrom)} to ${formatIsoDate(dateTo)}`;
  if (dateFrom) return `From ${formatIsoDate(dateFrom)}`;
  if (dateTo) return `Through ${formatIsoDate(dateTo)}`;
  return "All Dates";
}
