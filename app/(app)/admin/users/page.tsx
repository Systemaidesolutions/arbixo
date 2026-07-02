import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/currentUser";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    include: { company: { select: { tradeName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-8 py-12">
      <h1 className="text-xl font-medium text-neutral-900">Users</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every account on this Arbixo instance — Arbixo admins and subscriber users.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Verified</th>
              <th className="px-3 py-2 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      u.role === "ADMIN" ? "bg-brand-navy/10 text-brand-navy" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {u.role === "ADMIN" ? "Arbixo admin" : "Subscriber"}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-500">{u.company?.tradeName ?? "—"}</td>
                <td className="px-3 py-2">
                  {u.isVerified ? (
                    <span className="text-brand-green">Verified</span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
