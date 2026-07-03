import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCompany } from "@/lib/currentUser";
import { PartyManager } from "../PartyManager";
import { PARTY_LABELS, type PartyEntityType } from "@/lib/parties";

const SLUG_TO_TYPE: Record<string, PartyEntityType> = {
  customers: "customer",
  vendors: "vendor",
  employees: "employee",
  contacts: "contact",
};

export default async function PartyPage({ params }: { params: { entity: string } }) {
  const type = SLUG_TO_TYPE[params.entity];
  if (!type) notFound();

  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-xl font-medium text-neutral-900">{PARTY_LABELS[type].plural}</h1>
        <p className="mt-2 text-neutral-600">
          No company is set up yet. Complete company setup first.
        </p>
      </main>
    );
  }

  const where = { companyId: company.id };
  const order = { orderBy: { code: "asc" as const } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = [];
  if (type === "customer") items = await prisma.customer.findMany({ where, ...order });
  else if (type === "vendor") items = await prisma.vendor.findMany({ where, ...order });
  else if (type === "employee") items = await prisma.employee.findMany({ where, ...order });
  else items = await prisma.contact.findMany({ where, ...order });

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-1 text-xl font-medium text-neutral-900">{PARTY_LABELS[type].plural}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Manage your {PARTY_LABELS[type].plural.toLowerCase()} — each in its own table.
      </p>
      <PartyManager entityType={type} companyId={company.id} initialItems={items} />
    </main>
  );
}
