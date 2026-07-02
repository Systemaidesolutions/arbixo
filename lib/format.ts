/** Formats a number as Philippine peso currency: ₱1,234.56 (negative: -₱1,234.56). */
export function formatPeso(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const s = Math.abs(v).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? "-₱" : "₱"}${s}`;
}
