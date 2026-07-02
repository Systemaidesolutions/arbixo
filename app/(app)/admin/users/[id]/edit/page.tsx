import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { AdminUserForm } from "../../AdminUserForm";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  await requireAdmin();

  const [user, companies] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.company.findMany({ select: { id: true, tradeName: true }, orderBy: { tradeName: "asc" } }),
  ]);
  if (!user) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <a href="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Back to users
      </a>
      <h1 className="mt-2 text-xl font-medium text-neutral-900">Edit user</h1>
      <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
      <AdminUserForm
        mode="edit"
        userId={user.id}
        initial={{
          email: user.email,
          role: user.role,
          subscriberSubtype: user.subscriberSubtype,
          companyId: user.companyId,
        }}
        companies={companies}
      />
    </main>
  );
}
