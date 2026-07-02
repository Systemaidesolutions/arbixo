"use client";

import { useState } from "react";
import type { Account, TaxPostingSetup } from "@prisma/client";

export function TaxPostingSetupClient({
  companyId,
  accounts,
  initialSetup,
}: {
  companyId: string;
  accounts: Account[];
  initialSetup: TaxPostingSetup | null;
}) {
  const [inputVatAccountId, setInputVatAccountId] = useState(initialSetup?.inputVatAccountId ?? "");
  const [outputVatAccountId, setOutputVatAccountId] = useState(initialSetup?.outputVatAccountId ?? "");
  const [withholdingTaxPayableAccountId, setWithholdingTaxPayableAccountId] = useState(
    initialSetup?.withholdingTaxPayableAccountId ?? ""
  );
  const [creditableWithholdingTaxAccountId, setCreditableWithholdingTaxAccountId] = useState(
    initialSetup?.creditableWithholdingTaxAccountId ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/tax-posting-setup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        inputVatAccountId: inputVatAccountId || null,
        outputVatAccountId: outputVatAccountId || null,
        withholdingTaxPayableAccountId: withholdingTaxPayableAccountId || null,
        creditableWithholdingTaxAccountId: creditableWithholdingTaxAccountId || null,
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  function AccountSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">Not set</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.title}
          </option>
        ))}
      </select>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-medium text-neutral-900">Tax posting setup</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tells the posting engine which accounts to hit automatically for VAT and withholding — the
        manual does this invisibly; here it's explicit and changeable. Journal entries that need
        one of these accounts will error clearly if it isn't set yet, rather than posting
        somewhere wrong.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className={label}>
          Input VAT account
          <AccountSelect value={inputVatAccountId} onChange={setInputVatAccountId} />
          <span className="mt-1 block text-xs text-neutral-400">
            Usually an Other Current Asset account — VAT paid on purchases, creditable against
            Output VAT.
          </span>
        </label>

        <label className={label}>
          Output VAT account
          <AccountSelect value={outputVatAccountId} onChange={setOutputVatAccountId} />
          <span className="mt-1 block text-xs text-neutral-400">
            Usually an Other Current Liability account — VAT collected on sales, owed to BIR.
          </span>
        </label>

        <label className={label}>
          Withholding tax payable account
          <AccountSelect
            value={withholdingTaxPayableAccountId}
            onChange={setWithholdingTaxPayableAccountId}
          />
          <span className="mt-1 block text-xs text-neutral-400">
            Other Current Liability — tax YOU withhold from vendors (Cash Disbursement,
            Purchases), remitted to BIR later.
          </span>
        </label>

        <label className={label}>
          Creditable withholding tax account
          <AccountSelect
            value={creditableWithholdingTaxAccountId}
            onChange={setCreditableWithholdingTaxAccountId}
          />
          <span className="mt-1 block text-xs text-neutral-400">
            Other Current Asset — tax a CUSTOMER withholds from paying you (Cash Receipts, Sales).
            Offsets your income tax due; not the same account as the liability above.
          </span>
        </label>

        {saved && <p className="text-sm text-green-600">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </main>
  );
}
