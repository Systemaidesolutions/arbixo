export type NavLink = { href: string; label: string };
export type NavSection = {
  title: string;
  icon: "settings" | "transactions" | "reports";
  links: NavLink[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Setup",
    icon: "settings",
    links: [
      { href: "/company/setup", label: "Company setup" },
      { href: "/company/tax-posting-setup", label: "Tax posting setup" },
      { href: "/accounts", label: "Chart of accounts" },
      { href: "/agents", label: "Customers, vendors, employees, contacts" },
    ],
  },
  {
    title: "Transactions",
    icon: "transactions",
    links: [
      { href: "/transactions/cash-disbursement", label: "Cash disbursement" },
      { href: "/transactions/cash-receipts", label: "Cash receipts" },
      { href: "/transactions/sales", label: "Sales on account" },
      { href: "/transactions/purchases", label: "Purchases on account" },
      { href: "/transactions/general-journal", label: "General journal" },
    ],
  },
  {
    title: "Reports",
    icon: "reports",
    links: [
      { href: "/reports/trial-balance", label: "Trial balance" },
      { href: "/reports/general-ledger", label: "General ledger" },
      { href: "/reports/subsidiary-ledger", label: "Debtors' / creditors' ledger" },
      { href: "/reports/income-statement", label: "Income statement" },
      { href: "/reports/balance-sheet", label: "Balance sheet" },
      { href: "/reports/bir/vat-return", label: "Monthly VAT return (BIR 2550M)" },
    ],
  },
];
