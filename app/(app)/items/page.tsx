import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { ItemsClient } from "./ItemsClient";

export default async function ItemsPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  const canEdit = Boolean(capability && !capability.isReadOnly);

  if (!company) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Items</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [items, accounts] = await Promise.all([
    prisma.item.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    prisma.account.findMany({ where: { companyId: company.id, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
  ]);

  const initial = items.map((i) => ({
    id: i.id, code: i.code, description: i.description,
    type: i.type as "INVENTORY" | "NON_INVENTORY" | "SERVICE", uom: i.uom,
    vatType: (i.vatType === "IMPORTATION" ? "VAT_12" : i.vatType) as "VAT_12" | "ZERO_RATED" | "VAT_EXEMPT" | "NON_VAT",
    defaultCost: Number(i.defaultCost), quantityOnHand: Number(i.quantityOnHand), avgCost: Number(i.avgCost),
    inventoryAccountId: i.inventoryAccountId, expenseAccountId: i.expenseAccountId, incomeAccountId: i.incomeAccountId, isActive: i.isActive,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Items</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Inventory, non-inventory and service items. Inventory items are stock-tracked with a moving
        weighted-average cost and post to their Inventory asset account when purchased.
      </p>
      <div className="mt-6">
        <ItemsClient initial={initial} accounts={accounts} canEdit={canEdit} />
      </div>
    </main>
  );
}
