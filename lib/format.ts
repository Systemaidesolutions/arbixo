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
