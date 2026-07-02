export type AdminNavLink = { href: string; label: string };

// Admin-only navigation. Kept separate from NAV_SECTIONS (the company
// bookkeeping menu) because admins manage tenants, not ledgers.
export const ADMIN_NAV: AdminNavLink[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Company list" },
  { href: "/admin/users", label: "User list" },
  { href: "/admin/setup", label: "Setup" },
];
