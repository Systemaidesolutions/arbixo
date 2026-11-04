import { headers } from "next/headers";
import type { User } from "@prisma/client";
import type { AppKey } from "@/lib/navigation";

// Which ARbixo apps (Accounting, Payroll) a user may open. Set per user by a
// platform admin (Admin › Users). Platform admins themselves are never
// restricted. Enforced on the /apps launcher, on pages (app layout) and on
// company-scoped data access for API routes (lib/currentUser.ts), using the
// request path that middleware.ts forwards in PATH_HEADER.

export const ALL_APPS: AppKey[] = ["accounting", "payroll"];
export const PATH_HEADER = "x-arbixo-path";

/** Cleans a list from a request body: known apps only, no duplicates, in a fixed order. */
export function cleanAppList(v: unknown): AppKey[] {
  const set = new Set(Array.isArray(v) ? v.map(String) : []);
  return ALL_APPS.filter((a) => set.has(a));
}

/** The apps this user may open. Admins: all. Old rows with nothing set: all. */
export function userApps(user: Pick<User, "role" | "appAccess">): AppKey[] {
  if (user.role === "ADMIN") return ALL_APPS;
  const list = cleanAppList(user.appAccess);
  return list.length ? list : ALL_APPS;
}

// Page routes that belong to one app only (everything else is shared:
// profile, company details, employees, branches…). Keep in step with
// ACCOUNTING_ONLY in lib/navigation.ts.
const ACCOUNTING_PAGES = ["/dashboard", "/transactions", "/reports", "/books", "/history", "/accounts", "/items", "/ask-arbi"];
// /api/ledger-entries stays shared: payroll uses it to cancel a posted run.
const ACCOUNTING_APIS = [
  "/api/transactions", "/api/reports", "/api/books", "/api/accounts", "/api/items", "/api/history",
  "/api/importations", "/api/payables", "/api/receivables", "/api/bir", "/api/tax-posting-setup", "/api/customers", "/api/vendors",
];
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** The app a request path belongs to, or null when it's shared by both. */
export function appForRequestPath(path: string): AppKey | null {
  if (under(path, "/payroll") || under(path, "/api/payroll")) return "payroll";
  if (ACCOUNTING_PAGES.some((p) => under(path, p)) || ACCOUNTING_APIS.some((p) => under(path, p))) return "accounting";
  return null;
}

/** The current request's path, as forwarded by middleware (empty if unknown). */
export function currentRequestPath(): string {
  try {
    return headers().get(PATH_HEADER) ?? "";
  } catch {
    return ""; // outside a request (scripts, tests)
  }
}

/** True when this user may use the app the current request belongs to. */
export function canUseCurrentPath(user: Pick<User, "role" | "appAccess">): boolean {
  const app = appForRequestPath(currentRequestPath());
  return !app || userApps(user).includes(app);
}
