import { prisma } from "@/lib/prisma";

export default async function AdminOverviewPage() {
  const [companyCount, userCount, adminCount] = await Promise.all([
    prisma.company.count(),
    prisma.user.count({ where: { userType: "SUBSCRIBER" } }),
    prisma.user.count({ where: { userType: "ADMIN" } }),
  ]);

  const cards = [
    { label: "Subscribing companies", value: companyCount, href: "/admin/companies" },
    { label: "Subscriber users", value: userCount, href: "/admin/users" },
    { label: "Admin users", value: adminCount, href: "/admin/users" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-xl font-semibold text-brand-navy">Overview</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everything across every company that subscribes to ARbixo.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <a
            key={c.label}
            href={c.href}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="text-3xl font-semibold text-brand-navy">{c.value}</div>
            <div className="mt-1 text-sm text-neutral-500">{c.label}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
