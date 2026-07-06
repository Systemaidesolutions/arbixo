import { randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Voucher, VoucherDiscountType } from "@prisma/client";

// Crockford-ish alphabet: no 0/O/1/I/L to avoid ambiguity when typed.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 10;

/** A random, unguessable voucher code (10 chars from a 31-symbol alphabet). */
export function generateVoucherCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export type VoucherStatusValue = "active" | "redeemed" | "disabled";

export function voucherStatus(v: Pick<Voucher, "isActive" | "redeemedAt">): VoucherStatusValue {
  if (v.redeemedAt) return "redeemed";
  if (!v.isActive) return "disabled";
  return "active";
}

/** Discount a voucher applies to a base amount (never below zero). */
export function voucherDiscount(
  v: Pick<Voucher, "discountType" | "discountValue">,
  baseAmount: number
): number {
  const val = Number(v.discountValue);
  const raw = v.discountType === "PERCENT" ? (baseAmount * val) / 100 : val;
  const capped = Math.min(Math.max(0, raw), baseAmount);
  return Math.round(capped * 100) / 100;
}

/**
 * Creates one or many vouchers with unique random codes. Batches are tagged
 * with a shared batchId. Codes are generated client-unique then inserted with
 * skipDuplicates as a safety net against the (astronomically rare) global
 * collision, and the actually-created codes are returned.
 */
export async function createVouchers(input: {
  count: number;
  discountType: VoucherDiscountType;
  discountValue: number;
  note?: string | null;
}): Promise<{ batchId: string | null; codes: string[] }> {
  const count = Math.min(Math.max(1, Math.floor(input.count) || 1), 500);
  const batchId = count > 1 ? randomUUID() : null;

  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateVoucherCode());
  const codeList = [...codes];

  await prisma.voucher.createMany({
    data: codeList.map((code) => ({
      code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      note: input.note?.trim() || null,
      batchId,
    })),
    skipDuplicates: true,
  });

  const created = await prisma.voucher.findMany({
    where: batchId ? { batchId } : { code: { in: codeList } },
    select: { code: true },
    orderBy: { createdAt: "asc" },
  });
  return { batchId, codes: created.map((c) => c.code) };
}
