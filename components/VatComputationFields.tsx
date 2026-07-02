"use client";

import { useEffect, useMemo } from "react";
import type { AtcCode, VatType } from "@prisma/client";
import { computeVat, computeWithholding } from "@/lib/vat";

const VAT_TYPE_LABELS: Record<VatType, string> = {
  VAT_12: "12% VAT",
  ZERO_RATED: "Zero-Rated",
  VAT_EXEMPT: "VAT Exempt",
  NON_VAT: "Non-VAT",
  IMPORTATION: "Importation",
};

export type VatComputationValue = {
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  withholdingAmt: number;
  atcCode: string | null;
  atcDescription: string | null;
};

/**
 * Mirrors the manual's "VAT Computation" popup — pick a VAT type, type
 * either the Gross or Net amount, optionally pick an ATC code for
 * withholding. Fully controlled: the parent journal-entry form owns the
 * state and reads the computed result via onChange, so this can be
 * embedded once per transaction line without fighting for state
 * ownership.
 */
export function VatComputationFields({
  vatType,
  onVatTypeChange,
  amount,
  onAmountChange,
  amountIsGross,
  onAmountIsGrossChange,
  atcCodes,
  atcCodeId,
  onAtcCodeChange,
  onChange,
}: {
  vatType: VatType;
  onVatTypeChange: (v: VatType) => void;
  amount: number;
  onAmountChange: (v: number) => void;
  amountIsGross: boolean;
  onAmountIsGrossChange: (v: boolean) => void;
  atcCodes: AtcCode[];
  atcCodeId: string | null;
  onAtcCodeChange: (id: string | null) => void;
  onChange?: (value: VatComputationValue) => void;
}) {
  const selectedAtc = atcCodes.find((a) => a.id === atcCodeId) ?? null;

  const vatResult = useMemo(
    () => computeVat({ vatType, amount: amount || 0, amountIsGross }),
    [vatType, amount, amountIsGross]
  );

  const withholdingAmt = useMemo(() => {
    if (!selectedAtc) return 0;
    return computeWithholding(vatResult.netAmount, Number(selectedAtc.ratePercent));
  }, [selectedAtc, vatResult.netAmount]);

  // Report the computed value up whenever any input changes, so the
  // parent form can store it without re-deriving the math itself.
  useEffect(() => {
    onChange?.({
      ...vatResult,
      withholdingAmt,
      atcCode: selectedAtc?.code ?? null,
      atcDescription: selectedAtc?.description ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vatResult, withholdingAmt, selectedAtc]);

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className={label}>
          VAT type
          <select
            value={vatType}
            onChange={(e) => onVatTypeChange(e.target.value as VatType)}
            className={field}
          >
            {Object.entries(VAT_TYPE_LABELS)
              .filter(([value]) => value !== "IMPORTATION") // separate flow per the manual
              .map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
          </select>
        </label>

        <label className={label}>
          Amount is
          <select
            value={amountIsGross ? "gross" : "net"}
            onChange={(e) => onAmountIsGrossChange(e.target.value === "gross")}
            disabled={vatType !== "VAT_12"}
            className={`${field} disabled:bg-neutral-100`}
          >
            <option value="gross">Gross</option>
            <option value="net">Net</option>
          </select>
          {vatType !== "VAT_12" && (
            <span className="mt-1 block text-xs text-neutral-400">
              Only Net applies for non-12%-VAT types.
            </span>
          )}
        </label>
      </div>

      <label className={label}>
        {vatType === "VAT_12" ? (amountIsGross ? "Gross amount" : "Net amount") : "Amount"}
        <input
          type="number"
          step="0.01"
          value={amount || ""}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          className={field}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded bg-neutral-50 p-3 text-sm">
        <div>
          <div className="text-xs text-neutral-400">Gross</div>
          <div className="font-mono">{vatResult.grossAmount.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Net</div>
          <div className="font-mono">{vatResult.netAmount.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">{vatType === "VAT_12" ? "VAT" : "VAT"}</div>
          <div className="font-mono">{vatResult.vatAmount.toFixed(2)}</div>
        </div>
      </div>

      <label className={label}>
        ATC code (withholding, optional)
        <select
          value={atcCodeId ?? ""}
          onChange={(e) => onAtcCodeChange(e.target.value || null)}
          className={field}
        >
          <option value="">None</option>
          {atcCodes.map((atc) => (
            <option key={atc.id} value={atc.id}>
              {atc.code} — {atc.description} ({Number(atc.ratePercent)}%)
            </option>
          ))}
        </select>
      </label>

      {selectedAtc && (
        <div className="rounded bg-neutral-50 p-3 text-sm">
          <div className="text-xs text-neutral-400">Withholding amount</div>
          <div className="font-mono">{withholdingAmt.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
