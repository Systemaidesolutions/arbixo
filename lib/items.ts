import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import type { ItemType, VatType } from "@prisma/client";

// Items are per-company operational data; anyone who can post transactions may
// manage them (they need items to encode purchases). Returns the caller's
// company id, or null if they can't post.
export async function posterCompanyId(): Promise<string | null> {
  const user = await getCurrentUserRecord();
  if (!user || user.role !== "USER" || !user.companyId) return null;
  return capabilitiesFor(user.role, user.subscriberSubtype).canPost ? user.companyId : null;
}

// CRUD for the inventory Item master (per company). Perpetual quantityOnHand /
// avgCost are maintained by stock movements on posting, never edited here.

export type ItemInput = {
  itemId?: string;
  code?: string;
  description?: string;
  type?: ItemType;
  uom?: string | null;
  vatType?: VatType;
  defaultCost?: number | string;
  inventoryAccountId?: string | null;
  expenseAccountId?: string | null;
  incomeAccountId?: string | null;
  isActive?: boolean;
};
export type ItemResult = { status: number; error?: string; item?: unknown; ok?: boolean };

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;
const num = (v: number | string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function baseData(raw: ItemInput) {
  return {
    description: (raw.description ?? "").trim(),
    type: raw.type ?? "INVENTORY",
    uom: clean(raw.uom),
    vatType: raw.vatType ?? "VAT_12",
    defaultCost: num(raw.defaultCost),
    inventoryAccountId: clean(raw.inventoryAccountId),
    expenseAccountId: clean(raw.expenseAccountId),
    incomeAccountId: clean(raw.incomeAccountId),
  };
}

export async function createItem(companyId: string, raw: ItemInput): Promise<ItemResult> {
  const code = (raw.code ?? "").trim();
  if (!code) return { status: 400, error: "Item code is required." };
  if (!(raw.description ?? "").trim()) return { status: 400, error: "Description is required." };
  try {
    const item = await prisma.item.create({
      data: { companyId, code, ...baseData(raw), isActive: raw.isActive ?? true },
    });
    return { status: 200, item };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { status: 409, error: "An item with that code already exists." };
    throw e;
  }
}

export async function updateItem(companyId: string, raw: ItemInput): Promise<ItemResult> {
  if (!raw.itemId) return { status: 400, error: "itemId is required." };
  if ("description" in raw && !(raw.description ?? "").trim()) return { status: 400, error: "Description is required." };
  const existing = await prisma.item.findFirst({ where: { id: raw.itemId, companyId }, select: { id: true } });
  if (!existing) return { status: 404, error: "Item not found." };

  const data = baseData(raw);
  const patch: Record<string, unknown> = { ...data };
  if ("code" in raw && (raw.code ?? "").trim()) patch.code = (raw.code ?? "").trim();
  if (typeof raw.isActive === "boolean") patch.isActive = raw.isActive;

  try {
    const item = await prisma.item.update({ where: { id: raw.itemId }, data: patch });
    return { status: 200, item };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { status: 409, error: "An item with that code already exists." };
    throw e;
  }
}
