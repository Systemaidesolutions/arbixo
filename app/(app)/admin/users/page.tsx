import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/currentUser";
import { AdminUsersTable, type AdminUserRow } from "./AdminUsersTable";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    include: { company: { select: { tradeName: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Count posted transactions per company so the table can decide which
  // users are safe to delete (deletion is blocked once a company has any).
  const companyIds = users
    .map((u) => u.companyId)
    .filter((id): id is string => Boolean(id));
  const txGroups = companyIds.length
    ? await prisma.ledgerEntry.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds } },
        _count: { _all: true },
      })
    : [];
  const txByCompany = new Map(txGroups.map((g) => [g.companyId, g._count._all]));

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    companyName: u.company?.tradeName ?? null,
    isVerified: u.isVerified,
    isDisabled: u.isDisabled,
    createdAt: u.createdAt.toISOString(),
    transactionCount: u.companyId ? txByCompany.get(u.companyId) ?? 0 : 0,
    isSelf: u.id === admin.id,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Users</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every account on this Arbixo instance. Disable an account to block sign-in without losing
        its data; deletion is only allowed while the user's company has no posted transactions.
      </p>

      <AdminUsersTable users={rows} />
    </main>
  );
}
