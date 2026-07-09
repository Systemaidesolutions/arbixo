import { prisma } from "@/lib/prisma";

type NarrowVat = "VAT_12" | "ZERO_RATED" | "VAT_EXEMPT" | "NON_VAT";
const narrowVat = (v: string): NarrowVat => (v === "IMPORTATION" ? "VAT_12" : (v as NarrowVat));

/** Reference data for the Purchase on Account form (vendors, items, accounts, branches). */
export async function loadPurchaseFormData(companyId: string) {
  const [vendors, items, accounts, branches, taxSetup] = await Promise.all([
    prisma.vendor.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, registeredName: true, tradeName: true, lastName: true, firstName: true, tin: true } }),
    prisma.item.findMany({ where: { companyId, isActive: true }, orderBy: { code: "asc" } }),
    prisma.account.findMany({ where: { companyId, isActive: true, accountType: "POSTING" }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true, classification: true } }),
    prisma.location.findMany({ where: { companyId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, branchCode: true } }),
    prisma.taxPostingSetup.findUnique({ where: { companyId }, select: { inputVatAccountId: true } }),
  ]);

  return {
    vendors: vendors.map((v) => ({
      id: v.id,
      code: v.code,
      name: v.registeredName || v.tradeName || `${v.lastName ?? ""} ${v.firstName ?? ""}`.trim() || v.code,
      tin: v.tin,
    })),
    items: items.map((i) => ({
      id: i.id, code: i.code, description: i.description, type: i.type, uom: i.uom,
      defaultCost: Number(i.defaultCost), vatType: narrowVat(i.vatType),
      inventoryAccountId: i.inventoryAccountId, expenseAccountId: i.expenseAccountId,
    })),
    accounts,
    branches,
    inputVatAccountId: taxSetup?.inputVatAccountId ?? null,
  };
}
