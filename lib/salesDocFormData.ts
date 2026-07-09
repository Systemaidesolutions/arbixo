import { prisma } from "@/lib/prisma";

type NarrowVat = "VAT_12" | "ZERO_RATED" | "VAT_EXEMPT" | "NON_VAT";
const narrowVat = (v: string): NarrowVat => (v === "IMPORTATION" ? "VAT_12" : (v as NarrowVat));

/** Reference data for the Sales Order form (customers, items, accounts, branches). */
export async function loadSalesFormData(companyId: string) {
  const [customers, items, accounts, branches, taxSetup] = await Promise.all([
    prisma.customer.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, registeredName: true, lastName: true, firstName: true, tin: true } }),
    prisma.item.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" } }),
    prisma.account.findMany({ where: { companyId, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true, classification: true } }),
    prisma.location.findMany({ where: { companyId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, branchCode: true } }),
    prisma.taxPostingSetup.findUnique({ where: { companyId }, select: { outputVatAccountId: true } }),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id, code: c.code,
      name: c.registeredName || `${c.lastName ?? ""} ${c.firstName ?? ""}`.trim() || c.code,
      tin: c.tin,
    })),
    items: items.map((i) => ({
      id: i.id, code: i.code, description: i.description, type: i.type, uom: i.uom,
      // for a sale, the line defaults to the item's default cost as a starting price hint
      defaultPrice: Number(i.defaultCost), vatType: narrowVat(i.vatType),
      avgCost: Number(i.avgCost), incomeAccountId: i.incomeAccountId, inventoryAccountId: i.inventoryAccountId, expenseAccountId: i.expenseAccountId,
    })),
    accounts,
    branches,
    outputVatAccountId: taxSetup?.outputVatAccountId ?? null,
  };
}
