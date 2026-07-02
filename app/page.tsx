import { prisma } from "@/lib/prisma";

const SECTIONS = [
  {
    title: "Setup",
    links: [
      { href: "/company/setup", label: "Company setup" },
      { href: "/company/tax-posting-setup", label: "Tax posting setup" },
      { href: "/accounts", label: "Chart of accounts" },
      { href: "/agents", label: "Customers, vendors, employees, contacts" },
    ],
  },
  {
    title: "Transactions",
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

export default async function HomePage() {
  const company = await prisma.company.findFirst();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-medium text-neutral-900">EJAS Web</h1>

      {!company ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            No company set up yet — start here before anything else will work.
          </p>
          <a
            href="/company/setup"
            className="mt-2 inline-block rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            Set up company
          </a>
        </div>
      ) : (
        <p className="mt-1 text-sm text-neutral-500">{company.tradeName}</p>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-neutral-700 hover:text-neutral-900 hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
