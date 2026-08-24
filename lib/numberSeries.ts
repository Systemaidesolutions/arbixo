// Pure helpers + config for master-data "No. Series". No prisma import here so
// this module is safe to use from client components. Server-side allocation
// lives in lib/numberSeriesServer.ts.

export type PartyEntity = "customer" | "vendor" | "employee" | "contact";

export const NUMBER_SERIES: { entityType: PartyEntity; label: string; defaultPrefix: string }[] = [
  { entityType: "customer", label: "Customers", defaultPrefix: "CUST" },
  { entityType: "vendor", label: "Vendors", defaultPrefix: "VEND" },
  { entityType: "employee", label: "Employees", defaultPrefix: "EMP" },
  { entityType: "contact", label: "Contacts", defaultPrefix: "CONT" },
];

export const SERIES_PADDING = 7;

// 1–10 letters/digits/hyphen, e.g. "CUST", "AR-C". Kept simple so codes stay
// tidy and file-safe (aligns with the app's no-special-characters rule).
export const PREFIX_PATTERN = /^[A-Za-z0-9-]{1,10}$/;

export function formatSeriesCode(prefix: string, n: number, padding = SERIES_PADDING): string {
  return `${prefix}${String(n).padStart(padding, "0")}`;
}
