import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { AdminCompanyForm } from "../AdminCompanyForm";
import { AuditToggle } from "../AuditToggle";
import { SubscriptionPanel } from "../SubscriptionPanel";
import { LogoField } from "../LogoField";

export default async function EditCompanyPage({ params }: { params: { id: string } }) {
  await requireAdmin();

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: { users: { select: { id: true, email: true } } },
  });
  if (!company) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <a href="/admin/companies" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Back to companies
      </a>
      <h1 className="mt-2 text-xl font-medium text-neutral-900">{company.tradeName}</h1>

      {/* Assigned users — a company can have many. Assignment itself is
          managed from the User list, one user at a time. */}
      <section className="mt-4 rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">
            Assigned users ({company.users.length})
          </h2>
          <a href="/admin/users" className="text-xs text-brand-blue hover:underline">
            Manage assignments →
          </a>
        </div>
        {company.users.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            No users assigned yet. Assign subscribers to this company from the User list.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {company.users.map((u) => (
              <li
                key={u.id}
                className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
              >
                {u.email}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Subscription + company access */}
      <div className="mt-6">
        <SubscriptionPanel
          companyId={company.id}
          initial={{
            isActive: company.isActive,
            billingEmail: company.billingEmail,
            subscriptionStartedAt: company.subscriptionStartedAt?.toISOString() ?? null,
            subscriptionEndsAt: company.subscriptionEndsAt?.toISOString() ?? null,
          }}
        />
      </div>

      {/* Company logo */}
      <div className="mt-6">
        <LogoField companyId={company.id} initial={company.logoUrl} />
      </div>

      {/* Settings — audit logging on/off */}
      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <AuditToggle companyId={company.id} initialEnabled={company.auditLogEnabled} />
      </section>

      <h2 className="mt-8 text-sm font-medium text-neutral-700">Update details</h2>
      <AdminCompanyForm mode="edit" companyId={company.id} initialCompany={company} />
    </main>
  );
}
