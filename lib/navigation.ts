export type NavIcon =
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
  | "approvals"
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
  | "contacts";

export type NavLink = { href: string; label: string; icon: NavIcon };
export type NavSection = {
  title: string;
  icon: "settings" | "transactions" | "reports" | "admin";
  links: NavLink[];
};

// Shown to subscriber (USER role) accounts — each is scoped to their
// own company via lib/currentUser.ts.
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Transactions",
    icon: "transactions",
    links: [
      { href: "/transactions/cash-disbursement", label: "Cash disbursement", icon: "cashOut" },
      { href: "/transactions/cash-receipts", label: "Cash receipts", icon: "cashIn" },
      { href: "/transactions/sales", label: "Sales Journal", icon: "sales" },
      { href: "/transactions/sales-order", label: "Sales Order", icon: "sales" },
      { href: "/transactions/purchases", label: "Purchase Journal", icon: "purchases" },
      { href: "/transactions/purchase-on-account", label: "Purchase Order", icon: "purchases" },
      { href: "/transactions/importations", label: "Importations", icon: "importations" },
      { href: "/transactions/general-journal", label: "General journal", icon: "journal" },
    ],
  },
  {
    title: "Reports",
    icon: "reports",
    links: [
      { href: "/reports/trial-balance", label: "Trial balance", icon: "trialBalance" },
      { href: "/reports/general-ledger", label: "General ledger", icon: "generalLedger" },
      { href: "/reports/subsidiary-ledger", label: "Debtors' / creditors' ledger", icon: "subsidiary" },
      { href: "/reports/income-statement", label: "Income statement", icon: "income" },
      { href: "/reports/balance-sheet", label: "Balance sheet", icon: "balance" },
      { href: "/reports/bir/vat-return", label: "Monthly VAT return (BIR 2550M)", icon: "vat" },
      { href: "/reports/bir/sls", label: "Summary List of Sales (SLS)", icon: "sales" },
      { href: "/reports/bir/slp", label: "Summary List of Purchases (SLP)", icon: "purchases" },
      { href: "/reports/bir/sli", label: "Summary List of Importations (SLI)", icon: "importations" },
      { href: "/reports/bir/qap", label: "Quarterly Alphalist of Payees (QAP)", icon: "withholding" },
      { href: "/reports/bir/sawt", label: "Summary Alphalist of Withholding Taxes (SAWT)", icon: "withholding" },
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
    ],
  },
  {
    title: "Setup",
    icon: "settings",
    links: [
      { href: "/company/setup", label: "Company details", icon: "company" },
      { href: "/company/branches", label: "Branches", icon: "companies" },
      { href: "/company/tax-posting-setup", label: "Tax posting setup", icon: "tax" },
      { href: "/accounts", label: "Chart of accounts", icon: "accounts" },
      { href: "/items", label: "Items", icon: "purchases" },
    ],
  },
];

// History — Business-Central-style browsers over posted ledger entries, plus
// the company audit trail. Manager-only (injected in the sidebar).
export const HISTORY_SECTION: NavSection = {
  title: "History",
  icon: "reports",
  links: [
    { href: "/history/sales", label: "Sales entries", icon: "sales" },
    { href: "/history/purchases", label: "Purchase entries", icon: "purchases" },
    { href: "/history/general-ledger", label: "General ledger entries", icon: "generalLedger" },
    { href: "/utility/audit-trail", label: "Audit trail", icon: "audit" },
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
      { href: "/admin/companies", label: "Company list", icon: "companies" },
      { href: "/admin/atc-codes", label: "ATC codes", icon: "withholding" },
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
      { href: "/subscription/payments", label: "Payments", icon: "payments" },
    ],
  },
  UTILITY_SECTION,
];
