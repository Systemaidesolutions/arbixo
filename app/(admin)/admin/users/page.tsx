import { prisma } from "@/lib/prisma";

const USER_TYPE_LABELS: Record<string, string> = {
  ADMIN: "ARbixo admin",
  SUBSCRIBER: "Subscriber",
};

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { company: { select: { tradeName: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-xl font-semibold text-brand-navy">User list</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every account across ARbixo — admins and each company's subscribers.
      </p>

      {users.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No users yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.userType === "ADMIN"
                          ? "bg-brand-navy/10 text-brand-navy"
                          : "bg-brand-blue/10 text-brand-blue"
                      }`}
                    >
                      {USER_TYPE_LABELS[u.userType] ?? u.userType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {u.company?.tradeName ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.isVerified ? (
                      <span className="text-brand-green">Verified</span>
                    ) : (
                      <span className="text-amber-600">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
