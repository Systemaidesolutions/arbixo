/** Formats a number with thousands separators and 2 decimals: 1,234.56 (no currency symbol). */
export function formatPeso(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
