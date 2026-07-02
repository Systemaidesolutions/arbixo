import Image from "next/image";
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
    <main className="mx-auto max-w-4xl px-8 py-12">
      {/* Hero — the real logo, not a re-typeset approximation */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/arbixo-logo.jpg"
          alt="Arbixo — Accounting Intelligence. Business Excellence. Powered by Systemaide Solutions Inc."
          width={480}
          height={269}
          priority
          className="h-auto w-full max-w-sm"
        />
      </div>

      {/* The accounting entity using this instance of the app */}
      <div className="mx-auto mt-10 max-w-xl">
        {!company ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-sm text-amber-900">
              No company is set up in this instance yet — start here before anything else will
              work.
            </p>
            <a
              href="/company/setup"
              className="mt-3 inline-block rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73]"
            >
              Set up company
            </a>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Company
            </div>
            <div className="mt-1 text-lg font-medium text-brand-navy">{company.tradeName}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-600">
              <dt className="text-neutral-400">TIN</dt>
              <dd className="font-mono">{company.tin}</dd>
              <dt className="text-neutral-400">Registration</dt>
              <dd>{company.registrationType === "VAT" ? "VAT Registered" : "Non-VAT Registered"}</dd>
              <dt className="text-neutral-400">Address</dt>
              <dd>{company.businessAddress}</dd>
              <dt className="text-neutral-400">RDO</dt>
              <dd>{company.rdoCode}</dd>
            </dl>
            <a href="/company/setup" className="mt-3 inline-block text-xs text-brand-blue hover:underline">
              Edit company details →
            </a>
          </div>
        )}
      </div>

      {/* Navigation to every section */}
      <div className="mt-12 grid gap-8 border-t border-neutral-100 pt-10 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-neutral-700 hover:text-brand-blue hover:underline">
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
