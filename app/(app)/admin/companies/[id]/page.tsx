import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { AdminCompanyForm } from "../AdminCompanyForm";

export default async function EditCompanyPage({ params }: { params: { id: string } }) {
  await requireAdmin();

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: { users: { select: { email: true } } },
  });
  if (!company) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <a href="/admin/companies" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Back to companies
      </a>
      <h1 className="mt-2 text-xl font-medium text-neutral-900">Edit company</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {company.users.length > 0
          ? `Assigned to ${company.users.map((u) => u.email).join(", ")}.`
          : "Not assigned to any subscriber yet."}
      </p>
      <AdminCompanyForm mode="edit" companyId={company.id} initialCompany={company} />
    </main>
  );
}
