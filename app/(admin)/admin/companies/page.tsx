import { prisma } from "@/lib/prisma";
import { REGISTRATION_TYPE_LABELS } from "@/lib/company";

export default async function AdminCompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-xl font-semibold text-brand-navy">Company list</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every company subscribing to ARbixo. Each keeps its own setup and books.
      </p>

      {companies.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No companies have been set up yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Trade name</th>
                <th className="px-4 py-3 font-medium">TIN</th>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">RDO</th>
                <th className="px-4 py-3 text-right font-medium">Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{c.tradeName}</td>
                  <td className="px-4 py-3 font-mono text-neutral-600">{c.tin}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {REGISTRATION_TYPE_LABELS[c.registrationType]}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{c.rdoCode}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{c._count.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
