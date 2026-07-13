// Payment terms are free text ("Net 30", "30 days", "COD", "15"). The due date
// is the transaction date plus the first number of days found in the terms; if
// there's no number (COD / Due on receipt / blank) the due date equals the
// transaction date.

/** First integer in the terms string, or 0 when there's none. */
export function termDays(terms?: string | null): number {
  if (!terms) return 0;
  const m = terms.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/**
 * Due date for a transaction, as a local YYYY-MM-DD string.
 * `date` is a YYYY-MM-DD string (as the date inputs use).
 */
export function computeDueDate(date: string, terms?: string | null): string {
  if (!date) return date;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + termDays(terms));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
