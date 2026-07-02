import type { VatType } from "@prisma/client";

const VAT_RATE = 0.12;

function round2(n: number): number {
  // Standard half-up rounding to centavos. Using this everywhere instead
  // of letting floating point drift is what keeps gross = net + vat exact
  // to the centavo, the way the manual's screenshots show it.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type VatComputationInput = {
  vatType: VatType;
  amount: number; // whatever the user typed
  amountIsGross: boolean; // true if `amount` is Gross, false if it's Net
};

export type VatComputationResult = {
  grossAmount: number;
  netAmount: number;
  vatAmount: number; // Input Tax (purchases) or Output Tax (sales)
};

/**
 * Mirrors the manual's "VAT Computation" popup: you can type either the
 * Gross or the Net amount and the other two figures fill in. Only VAT_12
 * actually splits gross into net + vat — every other type (Zero-Rated,
 * VAT Exempt, Non-VAT) has no VAT component, per the manual's own note:
 * "if Purchase/Sales Type is other than 12% VAT, fill up only the Net
 * Amount portion."
 *
 * Verified against the manual's own worked example: Gross 8,000.00 →
 * Net 7,142.86, Input Tax 857.14 (page 16).
 */
export function computeVat(input: VatComputationInput): VatComputationResult {
  const { vatType, amount, amountIsGross } = input;

  if (vatType !== "VAT_12") {
    const net = round2(amount);
    return { grossAmount: net, netAmount: net, vatAmount: 0 };
  }

  if (amountIsGross) {
    const gross = round2(amount);
    const net = round2(gross / (1 + VAT_RATE));
    const vat = round2(gross - net);
    return { grossAmount: gross, netAmount: net, vatAmount: vat };
  }

  const net = round2(amount);
  const vat = round2(net * VAT_RATE);
  const gross = round2(net + vat);
  return { grossAmount: gross, netAmount: net, vatAmount: vat };
}

/**
 * Withholding tax base is the VAT-exclusive (Net) amount — confirmed
 * against the manual's own numbers: Net Amount 7,142.86 × 1% (WC158) =
 * 71.43 Withholding Amt (page 16); Net Amount 8,928.57 × 2% (WC160) =
 * 178.57 (page 59).
 *
 * `ratePercent` is NOT hardcoded per ATC code here — it comes from the
 * editable AtcCode reference table, since BIR revises these rates
 * periodically (see the schema comment above AtcCode).
 */
export function computeWithholding(netAmount: number, ratePercent: number): number {
  return round2(netAmount * (ratePercent / 100));
}

/**
 * Convenience wrapper for the common case: compute VAT and withholding
 * in one call, e.g. when saving a line where both are known.
 */
export function computeVatAndWithholding(
  input: VatComputationInput,
  withholdingRatePercent?: number
): VatComputationResult & { withholdingAmt: number } {
  const vat = computeVat(input);
  const withholdingAmt = withholdingRatePercent
    ? computeWithholding(vat.netAmount, withholdingRatePercent)
    : 0;
  return { ...vat, withholdingAmt };
}
