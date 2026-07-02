"use client";

import { useState } from "react";
import type { AtcCode, VatType } from "@prisma/client";
import { VatComputationFields, type VatComputationValue } from "@/components/VatComputationFields";

export function VatCalculatorDemo({ atcCodes }: { atcCodes: AtcCode[] }) {
  const [vatType, setVatType] = useState<VatType>("VAT_12");
  const [amount, setAmount] = useState(8000);
  const [amountIsGross, setAmountIsGross] = useState(true);
  const [atcCodeId, setAtcCodeId] = useState<string | null>(null);
  const [result, setResult] = useState<VatComputationValue | null>(null);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-medium text-neutral-900">VAT / withholding calculator</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Standalone test harness for the shared calculator every journal screen will embed. Try
        8,000 gross at 12% VAT — it should match the manual's page 16 example exactly (Net
        7,142.86, Input Tax 857.14).
      </p>

      <div className="mt-6">
        <VatComputationFields
          vatType={vatType}
          onVatTypeChange={setVatType}
          amount={amount}
          onAmountChange={setAmount}
          amountIsGross={amountIsGross}
          onAmountIsGrossChange={setAmountIsGross}
          atcCodes={atcCodes}
          atcCodeId={atcCodeId}
          onAtcCodeChange={setAtcCodeId}
          onChange={setResult}
        />
      </div>

      {result && (
        <div className="mt-6 rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Value a journal screen would save
          </h2>
          <pre className="overflow-x-auto text-xs text-neutral-600">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {atcCodes.length === 0 && (
        <p className="mt-4 text-xs text-amber-600">
          No ATC codes seeded yet — run <code className="font-mono">npm run prisma:seed</code>.
        </p>
      )}
    </main>
  );
}
