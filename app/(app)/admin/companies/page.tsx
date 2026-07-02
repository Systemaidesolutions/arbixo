import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/currentUser";

export default async function AdminCompaniesPage() {
  await requireAdmin();

  const companies = await prisma.company.findMany({
    include: { users: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Companies</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every subscriber company set up on this Arbixo instance.
          </p>
        </div>
        <a
          href="/admin/companies/new"
          className="rounded bg-brand-navy px-4 py-2 text-sm text-white hover:bg-brand-navyLight"
        >
          + Create company
        </a>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Trade name</th>
              <th className="px-3 py-2 text-left">TIN</th>
              <th className="px-3 py-2 text-left">Registration</th>
              <th className="px-3 py-2 text-left">Users</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {companies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">
                  No companies have been set up yet.
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">
                    <a href={`/admin/companies/${c.id}`} className="text-brand-navy hover:underline">
                      {c.tradeName}
                    </a>
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-500">{c.tin}</td>
                  <td className="px-3 py-2 text-neutral-500">
                    {c.registrationType === "VAT" ? "VAT" : "Non-VAT"}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {c.users.map((u) => u.email).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
