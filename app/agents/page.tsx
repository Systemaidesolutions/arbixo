import { prisma } from "@/lib/prisma";
import { AgentsClient } from "./AgentsClient";

export default async function AgentsPage() {
  const company = await prisma.company.findFirst();

  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="text-xl font-medium text-neutral-900">Agents</h1>
        <p className="mt-2 text-neutral-600">
          No company is set up yet. Complete company setup before creating customers, vendors,
          employees, or contacts.
        </p>
      </main>
    );
  }

  const [customers, vendors, employees, contacts] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    prisma.vendor.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    prisma.employee.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    prisma.contact.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
  ]);

  return (
    <AgentsClient
      companyId={company.id}
      initialData={{ customer: customers, vendor: vendors, employee: employees, contact: contacts }}
    />
  );
}
