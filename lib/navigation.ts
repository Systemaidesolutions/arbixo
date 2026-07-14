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
    ],
  },
  {
    title: "BIR Reports",
    icon: "reports",
    links: [
      { href: "/reports/bir/vat-return", label: "VAT Return", icon: "vat" },
      { href: "/reports/bir/expanded-withholding", label: "Expanded Withholding Tax", icon: "withholding" },
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
      { href: "/company/setup", label: "Company details", icon: "company" },
      { href: "/company/branches", label: "Branches", icon: "companies" },
      { href: "/company/tax-posting-setup", label: "Tax posting setup", icon: "tax" },
      { href: "/accounts", label: "Chart of accounts", icon: "accounts" },
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
