import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/currentUser";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  const [companyCount, subscriberCount, unverifiedCount] = await Promise.all([
    prisma.company.count(),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", isVerified: false } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <h1 className="text-xl font-medium text-neutral-900">Admin dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Signed in as {admin.email} (Arbixo admin).</p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-neutral-200 p-4">
          <div className="text-2xl font-medium text-brand-navy">{companyCount}</div>
          <div className="text-xs text-neutral-500">Subscriber companies</div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <div className="text-2xl font-medium text-brand-navy">{subscriberCount}</div>
          <div className="text-xs text-neutral-500">Subscriber users</div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <div className="text-2xl font-medium text-brand-navy">{unverifiedCount}</div>
          <div className="text-xs text-neutral-500">Unverified accounts</div>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <a
          href="/admin/users"
          className="rounded border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          View user list →
        </a>
        <a
          href="/admin/companies"
          className="rounded border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          View company list →
        </a>
      </div>
    </main>
  );
}
