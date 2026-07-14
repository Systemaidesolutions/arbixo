import { prisma } from "@/lib/prisma";
import type { EwtAtcRow, ExpandedWithholding } from "@/lib/ewt1601eq";

// BIR 1601-EQ (Expanded Withholding Tax) — the creditable withholding tax the
// company withheld from its payees on income payments (purchases / cash
// disbursements). Aggregated by ATC for the selected period. This is the same
// data as QAP (the per-payee alphalist), summed per ATC instead of per payee.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function num(d: unknown): number {
  return Number(d ?? 0);
}

export async function getExpandedWithholding(
  companyId: string,
  from: Date,
  to: Date,
  locationId?: string
): Promise<ExpandedWithholding> {
  const [entries, atcCodes] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        companyId,
        ...(locationId ? { locationId } : {}),
        isCancelled: false,
        postingDate: { gte: from, lte: to },
        // The company is the withholding agent on money it pays out.
        journalType: { in: ["PURCHASE_ON_ACCOUNT", "CASH_DISBURSEMENT"] },
        atcCode: { not: null },
      },
    }),
    prisma.atcCode.findMany(),
  ]);
  const byCode = new Map(atcCodes.map((a) => [a.code, a]));

  const map = new Map<string, EwtAtcRow>();
  for (const e of entries) {
    const atc = e.atcCode!;
    let row = map.get(atc);
    if (!row) {
      const meta = byCode.get(atc);
      row = {
        atcCode: atc,
        atcDescription: e.atcDescription ?? meta?.description ?? "",
        ratePercent: Number(meta?.ratePercent ?? 0),
        taxBase: 0,
        taxWithheld: 0,
      };
      map.set(atc, row);
    }
    // Income base = the main line's net (its debit, or credit on a return).
    const sign = e.isReturn ? -1 : 1;
    row.taxBase += (num(e.debitAmount) + num(e.creditAmount)) * sign;
    row.taxWithheld += num(e.withholdingAmt) * sign;
  }

  const rows = [...map.values()]
    .map((r) => ({ ...r, taxBase: round2(r.taxBase), taxWithheld: round2(r.taxWithheld) }))
    .sort((a, b) => a.atcCode.localeCompare(b.atcCode));
  const totalWithheld = round2(rows.reduce((s, r) => s + r.taxWithheld, 0));

  return { rows, totalWithheld };
}
