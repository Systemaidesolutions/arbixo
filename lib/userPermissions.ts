// Per-user access groups for the Accounting app (Admin › User access).
// Every user starts with ALL groups; an admin removes the ones a user
// shouldn't have. Only the removed ones are stored (User.deniedPermissions),
// so a new group added later is granted to everyone by default.
//
// Pure and dependency-free: used by middleware (edge), the app layout,
// the sidebar and the admin screen. Platform admins are never restricted.

export const PERMISSIONS = [
  { key: "transactions", label: "Can do transactions", description: "Encode, post and cancel Cash Receipts, Sales, Cash Disbursement, Purchases, Importations and General Journal." },
  { key: "importTransactions", label: "Can import transactions", description: "Bring in transactions from Excel / CSV files." },
  { key: "viewReports", label: "Can view reports", description: "Financial reports, BIR reports and Books of Accounts." },
  { key: "printReports", label: "Can print", description: "Print reports, books, vouchers, invoices, checks and 2307." },
  { key: "exportFiles", label: "Can generate files", description: "Export to Excel and generate BIR .DAT relief files." },
  { key: "viewHistory", label: "Can view history", description: "Browse posted transactions under History." },
  { key: "viewSetup", label: "Can view setup", description: "Open Setup and Master Data: company details, branches, tax posting setup, chart of accounts, customers, vendors, employees, contacts, items." },
  { key: "changeSetup", label: "Can change setup", description: "Add, edit or delete setup and master data records (includes quick-adding a customer or vendor from a transaction)." },
  { key: "askArbi", label: "Can use Ask ARbi", description: "Generate reports by asking in plain language." },
  { key: "utility", label: "Can use utility", description: "Audit trail and company backup / restore (Managers only)." },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);
export const permissionLabel = (k: PermissionKey) => PERMISSIONS.find((p) => p.key === k)?.label ?? k;

/** Cleans a list from a request body / DB row: known keys only, no duplicates, fixed order. */
export function cleanDenied(v: unknown): PermissionKey[] {
  const set = new Set(Array.isArray(v) ? v.map(String) : []);
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

/**
 * A requirement is a list of groups; every group must be met, and a group is
 * met when the user has ANY of its keys.
 */
export type Requirement = PermissionKey[][];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const hasSegment = (path: string, seg: string) => path.split("/").includes(seg);

// A posted document can be opened from History and from reports, not just
// by someone who encodes transactions.
const VIEW_DOCUMENT: PermissionKey[] = ["transactions", "viewHistory", "viewReports"];

/** What a page needs. Empty: open to everyone. */
export function pageRequirement(path: string): Requirement {
  const req: Requirement = [];
  if (under(path, "/transactions")) {
    if (["/transactions/view", "/transactions/voucher", "/transactions/check", "/transactions/sales-invoice"].some((p) => under(path, p))) {
      req.push(VIEW_DOCUMENT);
    } else {
      req.push(["transactions"]);
      if (hasSegment(path, "import")) req.push(["importTransactions"]);
    }
  } else if (under(path, "/reports") || under(path, "/books")) {
    req.push(["viewReports"]);
  } else if (under(path, "/history")) {
    req.push(["viewHistory"]);
  } else if (["/company", "/accounts", "/agents", "/items", "/payroll/employee-records"].some((p) => under(path, p))) {
    req.push(["viewSetup"]);
  } else if (under(path, "/ask-arbi")) {
    req.push(["askArbi"]);
  } else if (under(path, "/utility")) {
    req.push(["utility"]);
  }
  if (req.length && (hasSegment(path, "print") || under(path, "/transactions/check") || under(path, "/transactions/voucher"))) req.push(["printReports"]);
  return req;
}

const TRANSACTION_APIS = ["/api/transactions", "/api/importations", "/api/ledger-entries", "/api/payables", "/api/receivables"];
const SETUP_APIS = ["/api/company", "/api/accounts", "/api/customers", "/api/vendors", "/api/contacts", "/api/employees", "/api/items", "/api/tax-posting-setup"];

/**
 * What an API request needs. Reads stay open (transaction forms load
 * accounts, customers… even for users who can't open those setup pages);
 * writes, file generation and printing are gated. `referer` is the path of
 * the page that made the request: Payroll cancels a posted run through
 * /api/ledger-entries, which isn't an Accounting transaction.
 */
export function apiRequirement(path: string, method: string, referer = ""): Requirement {
  if (!under(path, "/api")) return [];
  const m = method.toUpperCase();
  const write = m !== "GET" && m !== "HEAD" && m !== "OPTIONS";

  if (under(path, "/api/export") || hasSegment(path, "export") || hasSegment(path, "dat")) return [["exportFiles"]];
  if (hasSegment(path, "pdf")) return [["printReports"]];
  if (under(path, "/api/ai")) return [["askArbi"]];
  if (under(path, "/api/utility")) return [["utility"]];
  if (under(path, "/api/payroll") || under(referer, "/payroll")) return [];
  if (!write) return [];

  if (TRANSACTION_APIS.some((p) => under(path, p))) {
    return hasSegment(path, "import") ? [["transactions"], ["importTransactions"]] : [["transactions"]];
  }
  if (SETUP_APIS.some((p) => under(path, p))) return [["changeSetup"]];
  return [];
}

/** The first group this user doesn't meet, or null when allowed. */
export function unmet(denied: readonly string[], req: Requirement): PermissionKey[] | null {
  for (const group of req) if (!group.some((k) => !denied.includes(k))) return group;
  return null;
}

export const allowed = (denied: readonly string[], req: Requirement) => unmet(denied, req) === null;

/** Message for a blocked request. */
export function deniedMessage(group: PermissionKey[]): string {
  return `Your account doesn't have "${group.map(permissionLabel).join('" or "')}" access. Ask your ARbixo admin to turn it on under Admin › User access.`;
}
