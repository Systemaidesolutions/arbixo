import { requireAdmin } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { AdminCompanyForm } from "../AdminCompanyForm";

export default async function NewCompanyPage() {
  await requireAdmin();

  const assignableUsers = await prisma.user.findMany({
    where: { role: "USER", companyId: null },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Create company</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Set up a subscriber company and assign it to their account. The subscriber will see these
        details read-only.
      </p>
      <AdminCompanyForm mode="create" assignableUsers={assignableUsers} />
    </main>
  );
}
