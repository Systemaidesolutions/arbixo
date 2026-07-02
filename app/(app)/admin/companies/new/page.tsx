import { requireAdmin } from "@/lib/currentUser";
import { AdminCompanyForm } from "../AdminCompanyForm";

export default async function NewCompanyPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Create company</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Create the company record. Afterwards, assign it to one or more subscriber users from the{" "}
        <a href="/admin/users" className="text-brand-blue hover:underline">
          User list
        </a>
        .
      </p>
      <AdminCompanyForm mode="create" />
    </main>
  );
}
