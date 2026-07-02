export type NavIcon =
  | "company"
  | "tax"
  | "accounts"
  | "parties"
  | "cashOut"
  | "cashIn"
  | "sales"
  | "purchases"
  | "journal"
  | "trialBalance"
  | "generalLedger"
  | "subsidiary"
  | "income"
  | "balance"
  | "vat"
  | "dashboard"
  | "users"
  | "companies"
  | "approvals"
  | "audit"
  | "backup";

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
    title: "Setup",
    icon: "settings",
    links: [
      { href: "/company/setup", label: "Company details", icon: "company" },
      { href: "/company/tax-posting-setup", label: "Tax posting setup", icon: "tax" },
      { href: "/accounts", label: "Chart of accounts", icon: "accounts" },
      { href: "/agents", label: "Customers, vendors, employees, contacts", icon: "parties" },
    ],
  },
  {
    title: "Transactions",
    icon: "transactions",
    links: [
      { href: "/transactions/cash-disbursement", label: "Cash disbursement", icon: "cashOut" },
      { href: "/transactions/cash-receipts", label: "Cash receipts", icon: "cashIn" },
      { href: "/transactions/sales", label: "Sales on account", icon: "sales" },
      { href: "/transactions/purchases", label: "Purchases on account", icon: "purchases" },
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
    ],
  },
];

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
    ],
  },
  UTILITY_SECTION,
];
