/**
 * Prisma's Decimal fields (Account.openingBalance, AtcCode.ratePercent,
 * every monetary field on LedgerEntry) come back as Decimal.js instances,
 * not plain numbers. React's Server → Client Component boundary only
 * supports plain objects and a short list of built-ins (Date, Map, Set,
 * ...) — passing a Decimal instance as a prop throws at runtime:
 * "Only plain objects can be passed from Server Components to Client
 * Components. Decimal objects are not supported."
 *
 * This round-trips through JSON, which calls Decimal's own toJSON()
 * (→ string) and leaves Dates as ISO strings. Both are safe to cross the
 * boundary. Note this means the runtime shape no longer exactly matches
 * the Prisma-generated TypeScript type (openingBalance is typed as
 * `Decimal | null` but is actually a string after this) — call sites
 * that need to compute with the value should wrap it in Number(), which
 * works whether the value is a Decimal-like object or a numeric string.
 */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
