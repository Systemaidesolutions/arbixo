"use client";

import { useMemo, useState } from "react";
import type {
  Account,
  AtcCode,
  Contact,
  CounterpartyType,
  Customer,
  Employee,
  Location,
  Vendor,
  VatType,
} from "@prisma/client";
import { VatComputationFields, type VatComputationValue } from "@/components/VatComputationFields";
import { CounterpartyPicker } from "@/components/CounterpartyPicker";
import { TransactionSummary } from "@/components/TransactionSummary";

type LineState = {
  key: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
  showParty: boolean;
  counterpartyType: CounterpartyType | null;
  counterpartyId: string | null;
  showVatInfo: boolean;
  vatType: VatType;
  vatInputAmount: number;
  amountIsGross: boolean;
  atcCodeId: string | null;
  vatComputed: VatComputationValue | null;
};

function newLine(): LineState {
  return {
    key: crypto.randomUUID(),
    accountId: "",
    debitAmount: 0,
    creditAmount: 0,
    description: "",
    showParty: false,
    counterpartyType: null,
    counterpartyId: null,
    showVatInfo: false,
    vatType: "NON_VAT",
    vatInputAmount: 0,
    amountIsGross: true,
    atcCodeId: null,
    vatComputed: null,
  };
}

export function GeneralJournalForm({
  companyId,
  accounts,
  vendors,
  employees,
  contacts,
  customers,
  atcCodes,
  locations,
  suggestedDocumentNo,
}: {
  companyId: string;
  accounts: Account[];
  vendors: Vendor[];
  employees: Employee[];
  contacts: Contact[];
  customers: Customer[];
  atcCodes: AtcCode[];
  locations: Location[];
  suggestedDocumentNo: string;
}) {
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState(locations.find((l) => l.isDefault)?.id ?? "");
  const [documentNo, setDocumentNo] = useState(suggestedDocumentNo);
  const [particulars, setParticulars] = useState("");
  const [lines, setLines] = useState<LineState[]>([newLine(), newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }
  function removeLine(key: string) {
    setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.key !== key) : prev));
  }

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);
    return { totalDebit, totalCredit, diff: Math.round((totalDebit - totalCredit) * 100) / 100 };
  }, [lines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      companyId,
      locationId: locationId || null,
      documentNo,
      postingDate,
      particulars,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debitAmount: l.debitAmount || 0,
        creditAmount: l.creditAmount || 0,
        description: l.description || null,
        counterpartyType: l.showParty ? l.counterpartyType : null,
        counterpartyId: l.showParty ? l.counterpartyId : null,
        vatType: l.showVatInfo ? l.vatType : null,
        grossAmount: l.showVatInfo ? l.vatComputed?.grossAmount ?? null : null,
        netAmount: l.showVatInfo ? l.vatComputed?.netAmount ?? null : null,
        vatAmount: l.showVatInfo ? l.vatComputed?.vatAmount ?? null : null,
        atcCodeId: l.showVatInfo ? l.atcCodeId : null,
      })),
    };

    const res = await fetch("/api/ledger-entries/general-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong posting this entry.");
      return;
    }

    setSuccess(`Posted JV ${documentNo}.`);
    setRefreshKey((k) => k + 1);

    const nextRes = await fetch(
      `/api/ledger-entries/next-document-no?companyId=${companyId}&journalType=GENERAL_JOURNAL`
    );
    const nextData = await nextRes.json();
    setDocumentNo(nextData.documentNo);
    setParticulars("");
    setLines([newLine(), newLine()]);
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">General journal</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Anything not covered by the other four journals — depreciation, capital goods purchases,
        importation, closing Input/Output VAT to VAT Payable. Pick both sides of the entry
        yourself; nothing here posts a companion line automatically.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-neutral-200 p-4">
          <label className={label}>
            Date
            <input
              type="date"
              required
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            JV no.
            <input
              required
              value={documentNo}
              onChange={(e) => setDocumentNo(e.target.value)}
              className={`${field} font-mono`}
            />
          </label>
          <label className={label}>
            Location (optional)
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-3 block text-xs text-neutral-500">
            Particulars
            <input value={particulars} onChange={(e) => setParticulars(e.target.value)} className={field} />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-900">Lines</h2>
            <button type="button" onClick={addLine} className="text-xs text-neutral-500 hover:text-neutral-900">
              + line
            </button>
          </div>

          {lines.map((line, i) => (
            <div key={line.key} className="rounded-lg border border-neutral-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Line {i + 1}</span>
                {lines.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    remove
                  </button>
                )}
              </div>

              <label className={`${label} mb-3`}>
                Account
                <select
                  required
                  value={line.accountId}
                  onChange={(e) => updateLine(line.key, { accountId: e.target.value })}
                  className={field}
                >
                  <option value="">Select…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={label}>
                  Debit
                  <input
                    type="number"
                    step="0.01"
                    value={line.debitAmount || ""}
                    onChange={(e) =>
                      updateLine(line.key, { debitAmount: Number(e.target.value), creditAmount: 0 })
                    }
                    className={field}
                  />
                </label>
                <label className={label}>
                  Credit
                  <input
                    type="number"
                    step="0.01"
                    value={line.creditAmount || ""}
                    onChange={(e) =>
                      updateLine(line.key, { creditAmount: Number(e.target.value), debitAmount: 0 })
                    }
                    className={field}
                  />
                </label>
              </div>

              <div className="flex gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => updateLine(line.key, { showParty: !line.showParty })}
                  className="text-neutral-500 hover:text-neutral-900"
                >
                  {line.showParty ? "− remove party" : "+ attach party"}
                </button>
                <button
                  type="button"
                  onClick={() => updateLine(line.key, { showVatInfo: !line.showVatInfo })}
                  className="text-neutral-500 hover:text-neutral-900"
                >
                  {line.showVatInfo ? "− remove VAT info" : "+ VAT info (for BIR reports)"}
                </button>
              </div>

              {line.showParty && (
                <div className="mt-3">
                  <CounterpartyPicker
                    counterpartyType={line.counterpartyType}
                    counterpartyId={line.counterpartyId}
                    onTypeChange={(t) => updateLine(line.key, { counterpartyType: t })}
                    onIdChange={(id) => updateLine(line.key, { counterpartyId: id })}
                    vendors={vendors}
                    employees={employees}
                    contacts={contacts}
                    customers={customers}
                  />
                </div>
              )}

              {line.showVatInfo && (
                <div className="mt-3 space-y-2">
                  <VatComputationFields
                    vatType={line.vatType}
                    onVatTypeChange={(v) => updateLine(line.key, { vatType: v })}
                    amount={line.vatInputAmount}
                    onAmountChange={(v) => updateLine(line.key, { vatInputAmount: v })}
                    amountIsGross={line.amountIsGross}
                    onAmountIsGrossChange={(v) => updateLine(line.key, { amountIsGross: v })}
                    atcCodes={atcCodes}
                    atcCodeId={line.atcCodeId}
                    onAtcCodeChange={(id) => updateLine(line.key, { atcCodeId: id })}
                    onChange={(computed) => updateLine(line.key, { vatComputed: computed })}
                  />
                  <p className="text-xs text-neutral-400">
                    This tags the line for BIR reports (gross/net/VAT amounts) — it does not post a
                    companion line. Add the Input/Output VAT line yourself if this entry needs one.
                  </p>
                  {line.vatComputed && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateLine(line.key, { debitAmount: line.vatComputed!.netAmount, creditAmount: 0 })}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                      >
                        Use net ({line.vatComputed.netAmount.toFixed(2)}) → Debit
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLine(line.key, { creditAmount: line.vatComputed!.netAmount, debitAmount: 0 })}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                      >
                        Use net → Credit
                      </button>
                      {line.vatComputed.vatAmount > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(line.key, { debitAmount: line.vatComputed!.vatAmount, creditAmount: 0 })
                            }
                            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                          >
                            Use VAT ({line.vatComputed.vatAmount.toFixed(2)}) → Debit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(line.key, { creditAmount: line.vatComputed!.vatAmount, debitAmount: 0 })
                            }
                            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                          >
                            Use VAT → Credit
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg bg-neutral-50 p-4 text-sm">
          <div>
            <div className="text-xs text-neutral-400">Total debit</div>
            <div className="font-mono">{totals.totalDebit.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-400">Total credit</div>
            <div className="font-mono">{totals.totalCredit.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-400">Difference</div>
            <div className={`font-mono font-medium ${totals.diff !== 0 ? "text-red-600" : "text-green-600"}`}>
              {totals.diff.toFixed(2)}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={saving || totals.diff !== 0}
          className="rounded bg-[#0B2A5E] hover:bg-[#123A73] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Posting…" : "Save & new"}
        </button>
      </form>

      <div className="mt-10">
        <TransactionSummary
          companyId={companyId}
          journalType="GENERAL_JOURNAL"
          documentNoLabel="JV no."
          counterpartyLabel="Party"
          refreshKey={refreshKey}
        />
      </div>
    </main>
  );
}
