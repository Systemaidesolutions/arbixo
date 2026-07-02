import { requireAdmin } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { AdminUserForm } from "../AdminUserForm";

export default async function NewUserPage() {
  await requireAdmin();
  const companies = await prisma.company.findMany({
    select: { id: true, tradeName: true },
    orderBy: { tradeName: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <a href="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Back to users
      </a>
      <h1 className="mt-2 text-xl font-medium text-neutral-900">Create user</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pick a User Type. A Subscriber requires a subtype that determines what they can do.
      </p>
      <AdminUserForm mode="create" companies={companies} />
    </main>
  );
}
