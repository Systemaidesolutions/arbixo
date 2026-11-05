export type NavIcon =
  | "assistant"
  | "company"
  | "tax"
  | "accounts"
  | "parties"
  | "cashOut"
  | "cashIn"
  | "sales"
  | "purchases"
  | "importations"
  | "journal"
  | "trialBalance"
  | "generalLedger"
  | "subsidiary"
  | "income"
  | "balance"
  | "vat"
  | "withholding"
  | "dashboard"
  | "users"
  | "companies"
  | "audit"
  | "backup"
  | "branding"
  | "links"
  | "pricing"
  | "voucher"
  | "payments"
  | "gcash"
  | "customers"
  | "vendors"
  | "employees"
  | "contacts"
  | "payroll"
  | "payrollSetup"
  | "leave"
  | "manual";

// external: opens in a new browser tab instead of the in-app page stack.
export type NavLink = { href: string; label: string; icon: NavIcon; external?: boolean };
// A collapsible sub-group of links nested inside a section (e.g. "Relief Files"
// under BIR Reports).
export type NavGroup = { group: string; links: NavLink[] };
export type NavItem = NavLink | NavGroup;
export const isNavGroup = (i: NavItem): i is NavGroup => "group" in i;
export type NavSection = {
  title: string;
  icon: "settings" | "transactions" | "reports" | "admin";
  links: NavItem[];
};

// Shown to subscriber (USER role) accounts — each is scoped to their
// own company via lib/currentUser.ts.
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Transactions",
    icon: "transactions",
    links: [
      { href: "/transactions/cash-receipts", label: "Cash Receipts", icon: "cashIn" },
      { href: "/transactions/sales", label: "Sales on Account", icon: "sales" },
      { href: "/transactions/cash-disbursement", label: "Cash Disbursement", icon: "cashOut" },
      { href: "/transactions/purchases", label: "Purchase on Account", icon: "purchases" },
      { href: "/transactions/importations", label: "Importations", icon: "importations" },
      { href: "/transactions/general-journal", label: "General journal", icon: "journal" },
    ],
  },
  {
    title: "Financial Report",
    icon: "reports",
    links: [
      { href: "/reports/trial-balance", label: "Trial balance", icon: "trialBalance" },
      { href: "/reports/balance-sheet", label: "Balance sheet", icon: "balance" },
      { href: "/reports/income-statement", label: "Income statement", icon: "income" },
      { href: "/reports/equity-statement", label: "Equity statement", icon: "balance" },
      { href: "/reports/cash-flow-statement", label: "Cash flow statement", icon: "cashIn" },
      { href: "/reports/subsidiary-ledger", label: "Debtors' / creditors' ledger", icon: "subsidiary" },
      { href: "/reports/general-ledger", label: "General ledger", icon: "generalLedger" },
      { href: "/reports/customer-balance", label: "Customer balance summary", icon: "customers" },
      { href: "/reports/statement-of-account", label: "Statement of Account", icon: "customers" },
      { href: "/reports/vendor-balance", label: "Vendor balance summary", icon: "vendors" },
    ],
  },
  {
    title: "BIR Reports",
    icon: "reports",
    links: [
      { href: "/reports/bir/vat-return", label: "VAT Return", icon: "vat" },
      { href: "/reports/bir/expanded-withholding", label: "Expanded Withholding Tax", icon: "withholding" },
      { href: "/reports/bir/form-2307", label: "Certificate of Tax Withheld (2307)", icon: "withholding" },
      {
        group: "Relief Files",
        links: [
          { href: "/reports/bir/sls", label: "Summary List of Sales (SLS)", icon: "sales" },
          { href: "/reports/bir/slp", label: "Summary List of Purchases (SLP)", icon: "purchases" },
          { href: "/reports/bir/sli", label: "Summary List of Importations (SLI)", icon: "importations" },
          { href: "/reports/bir/qap", label: "Quarterly Alphalist of Payees (QAP)", icon: "withholding" },
          { href: "/reports/bir/sawt", label: "Summary Alphalist of Withholding Taxes (SAWT)", icon: "withholding" },
        ],
      },
    ],
  },
  {
    title: "Books of Accounts",
    icon: "reports",
    links: [
      { href: "/books/cash-receipts", label: "Cash Receipts Journal", icon: "cashIn" },
      { href: "/books/cash-disbursement", label: "Cash Disbursement Journal", icon: "cashOut" },
      { href: "/books/general-journal", label: "General Journal", icon: "journal" },
      { href: "/books/general-ledger", label: "General Ledger", icon: "generalLedger" },
      { href: "/books/sales", label: "Sales Subsidiary Journal", icon: "sales" },
      { href: "/books/purchases", label: "Purchase Subsidiary Journal", icon: "purchases" },
    ],
  },
  {
    title: "Master Data",
    icon: "settings",
    links: [
      { href: "/agents/customers", label: "Customers", icon: "customers" },
      { href: "/agents/vendors", label: "Vendors", icon: "vendors" },
      { href: "/agents/employees", label: "Employees", icon: "employees" },
      { href: "/agents/contacts", label: "Contacts", icon: "contacts" },
      { href: "/items", label: "Items", icon: "purchases" },
    ],
  },
  {
    title: "Setup",
    icon: "settings",
    links: [
      { href: "/ask-arbi", label: "Ask ARbi", icon: "assistant" },
      { href: "/company/setup", label: "Company details", icon: "company" },
      { href: "/company/branches", label: "Branches", icon: "companies" },
      { href: "/company/tax-posting-setup", label: "Tax posting setup", icon: "tax" },
      { href: "/accounts", label: "Chart of accounts", icon: "accounts" },
    ],
  },
];

// ARbixo is two apps on one login: Accounting (NAV_SECTIONS above) and
// Payroll. The user picks one on /apps after signing in; the choice is kept
// in the APP_COOKIE cookie and decides which sidebar they see.
export type AppKey = "accounting" | "payroll";
export const APP_COOKIE = "arbixo_app";
export const APP_HOME: Record<AppKey, string> = { accounting: "/dashboard", payroll: "/payroll" };
export const APP_LABEL: Record<AppKey, string> = { accounting: "Accounting", payroll: "Payroll" };

// Routes that belong to one app only. Anything else (profile, branches,
// company details, employee master…) is shared and keeps the cookie's app.
const ACCOUNTING_ONLY = ["/dashboard", "/transactions", "/reports", "/books", "/history", "/accounts", "/items", "/ask-arbi"];

export function appForPath(pathname: string, cookieApp: AppKey | null): AppKey {
  if (pathname === "/payroll" || pathname.startsWith("/payroll/")) return "payroll";
  if (ACCOUNTING_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "accounting";
  return cookieApp ?? "accounting";
}

export const PAYROLL_NAV_SECTIONS: NavSection[] = [
  {
    title: "Payroll",
    icon: "transactions",
    links: [
      { href: "/payroll/runs", label: "Payroll runs", icon: "payroll" },
      { href: "/payroll/employees", label: "Payroll employees", icon: "employees" },
      { href: "/payroll/leaves", label: "Leave", icon: "leave" },
    ],
  },
  {
    title: "Setup",
    icon: "settings",
    links: [
      { href: "/payroll/setup", label: "Payroll setup", icon: "payrollSetup" },
      { href: "/payroll/leave-types", label: "Leave types", icon: "leave" },
      { href: "/payroll/leave-portal", label: "Employee leave portal", icon: "leave" },
      { href: "/agents/employees", label: "Employees", icon: "employees" },
      { href: "/company/branches", label: "Branches", icon: "companies" },
      { href: "/company/setup", label: "Company details", icon: "company" },
      { href: "/payroll/manual", label: "User manual", icon: "manual" },
    ],
  },
];

// History — one posted-transaction browser per journal (document-level).
// Shown to every subscriber (injected in the sidebar).
export const HISTORY_SECTION: NavSection = {
  title: "History",
  icon: "reports",
  links: [
    { href: "/history/transactions/cash-receipts", label: "Cash Receipts", icon: "cashIn" },
    { href: "/history/transactions/sales", label: "Sales on Account", icon: "sales" },
    { href: "/history/transactions/cash-disbursement", label: "Cash Disbursement", icon: "cashOut" },
    { href: "/history/transactions/purchases", label: "Purchase on Account", icon: "purchases" },
    { href: "/history/transactions/general-journal", label: "General Journal", icon: "journal" },
  ],
};

// Utility tools — shown to admins (full) and, in the sidebar, to Managers
// (audit + per-company backup). The backup page itself adapts what it
// offers based on the viewer's role.
export const UTILITY_SECTION: NavSection = {
  title: "Utility",
  icon: "admin",
  links: [
    { href: "/utility/audit-trail", label: "Audit trail", icon: "audit" },
    { href: "/utility/backup", label: "Data backup", icon: "backup" },
  ],
};

// Shown to ADMIN (Arbixo staff) accounts instead of NAV_SECTIONS —
// admins manage the platform, not any single company's books.
export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "Admin",
    icon: "admin",
    // Dashboard is the top-level nav button, so it isn't repeated here.
    links: [
      { href: "/admin/users", label: "User list", icon: "users" },
      { href: "/admin/user-access", label: "User access", icon: "users" },
      { href: "/admin/companies", label: "Company list", icon: "companies" },
      { href: "/admin/atc-codes", label: "ATC codes", icon: "withholding" },
      { href: "/admin/accounts/standard-chart", label: "Chart of accounts", icon: "accounts" },
      { href: "/admin/branding", label: "Branding", icon: "branding" },
      { href: "/admin/related-links", label: "Related links", icon: "links" },
    ],
  },
  {
    title: "Subscription",
    icon: "admin",
    links: [
      { href: "/admin/subscription/renewals", label: "Renewals", icon: "companies" },
      { href: "/admin/subscription/pricing", label: "Pricing", icon: "pricing" },
      { href: "/admin/subscription/vouchers", label: "Vouchers", icon: "voucher" },
      { href: "/admin/subscription/gcash", label: "GCash account", icon: "gcash" },
      { href: "/admin/subscription/business-profile", label: "Business profile", icon: "company" },
      { href: "/subscription/payments", label: "Payments", icon: "payments" },
    ],
  },
  UTILITY_SECTION,
];
