"use client";

import { useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { Account, AtcCode, Customer, Location, VatType } from "@prisma/client";
import { VatComputationFields, type VatComputationValue } from "@/components/VatComputationFields";
import { CounterpartyPicker } from "@/components/CounterpartyPicker";
import { TransactionSummary } from "@/components/TransactionSummary";

type LineState = {
  key: string;
  accountId: string;
  vatType: VatType;
  amount: number;
  amountIsGross: boolean;
  atcCodeId: string | null;
  computed: VatComputationValue | null;
};

function newLine(): LineState {
  return {
    key: crypto.randomUUID(),
    accountId: "",
    vatType: "NON_VAT",
    amount: 0,
    amountIsGross: true,
    atcCodeId: null,
    computed: null,
  };
}

export function SalesForm({
  companyId,
  accounts,
  receivableAccounts,
  customers,
  atcCodes,
  locations,
  suggestedDocumentNo,
}: {
  companyId: string;
  accounts: Account[];
  receivableAccounts: Account[];
  customers: Customer[];
  atcCodes: AtcCode[];
  locations: Location[];
  suggestedDocumentNo: string;
}) {
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState(locations.find((l) => l.isDefault)?.id ?? "");
  const [documentNo, setDocumentNo] = useState(suggestedDocumentNo);
  const [isReturn, setIsReturn] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [receivableAccountId, setReceivableAccountId] = useState(receivableAccounts[0]?.id ?? "");
  const [particulars, setParticulars] = useState("");
  const [lines, setLines] = useState<LineState[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [customerList, setCustomerList] = useState(customers);

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }
  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  const totals = useMemo(() => {
    let totalCredit = 0;
    let totalWithholding = 0;
    for (const line of lines) {
      if (!line.computed) continue;
      totalCredit += line.computed.netAmount + line.computed.vatAmount;
      totalWithholding += line.computed.withholdingAmt;
    }
    const receivableAmount = Math.round((totalCredit - totalWithholding) * 100) / 100;
    return { totalCredit, totalWithholding, receivableAmount };
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
      isReturn,
      counterpartyType: "CUSTOMER" as const,
      counterpartyId: customerId,
      receivableAccountId,
      particulars,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        amount: l.amount,
        vatType: l.vatType,
        amountIsGross: l.amountIsGross,
        atcCodeId: l.atcCodeId,
      })),
    };

    const res = await fetch("/api/ledger-entries/sales", {
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

    setSuccess(`Posted ${isReturn ? "CM" : "Invoice"} ${documentNo}.`);
    setRefreshKey((k) => k + 1);

    const nextRes = await fetch(
      `/api/ledger-entries/next-document-no?companyId=${companyId}&journalType=SALES_ON_ACCOUNT`
    );
    const nextData = await nextRes.json();
    setDocumentNo(nextData.documentNo);
    setCustomerId(null);
    setParticulars("");
    setIsReturn(false);
    setLines([newLine()]);
  }

  const field = "mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const label = "block text-xs text-neutral-500";

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Sales on account</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Invoices billed to a customer's account — no cash moves until they pay (recorded
        separately, as a Cash Receipt).
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
            {isReturn ? "CM no." : "Invoice no."}
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

          <label className="col-span-3 flex items-center gap-2 text-xs text-neutral-500">
            <input type="checkbox" checked={isReturn} onChange={(e) => setIsReturn(e.target.checked)} />
            Sales return (reverses the entry below — customer sent goods back or invoice was
            cancelled)
          </label>

          <div className="col-span-2">
            <CounterpartyPicker
              counterpartyType="CUSTOMER"
              counterpartyId={customerId}
              onTypeChange={() => {}}
              onIdChange={setCustomerId}
              vendors={[]}
              employees={[]}
              contacts={[]}
              customers={customerList}
              types={["CUSTOMER"]}
              label="Customer"
              companyId={companyId}
              onCreated={(_t, record) => {
                setCustomerList((l) => [...l, record as (typeof customerList)[number]]);
                setCustomerId(record.id);
              }}
            />
          </div>

          <label className={label}>
            Receivable account
            <select
              required
              value={receivableAccountId}
              onChange={(e) => setReceivableAccountId(e.target.value)}
              className={field}
            >
              {receivableAccounts.length === 0 && (
                <option value="">No Accounts Receivable accounts yet</option>
              )}
              {receivableAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.title}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-3 block text-xs text-neutral-500">
            Income description
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
                {lines.length > 1 && (
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
                Income account
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

              <VatComputationFields
                vatType={line.vatType}
                onVatTypeChange={(v) => updateLine(line.key, { vatType: v })}
                amount={line.amount}
                onAmountChange={(v) => updateLine(line.key, { amount: v })}
                amountIsGross={line.amountIsGross}
                onAmountIsGrossChange={(v) => updateLine(line.key, { amountIsGross: v })}
                atcCodes={atcCodes}
                atcCodeId={line.atcCodeId}
                onAtcCodeChange={(id) => updateLine(line.key, { atcCodeId: id })}
                onChange={(computed) => updateLine(line.key, { computed })}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg bg-neutral-50 p-4 text-sm">
          <div>
            <div className="text-xs text-neutral-400">Total credit</div>
            <div className="font-mono">{formatPeso(totals.totalCredit)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-400">Withholding</div>
            <div className="font-mono">{formatPeso(totals.totalWithholding)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-400">Receivable (debit)</div>
            <div className="font-mono font-medium">{formatPeso(totals.receivableAmount)}</div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[#0B2A5E] hover:bg-[#123A73] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Posting…" : "Save & new"}
        </button>
      </form>

      <div className="mt-10">
        <TransactionSummary
          companyId={companyId}
          journalType="SALES_ON_ACCOUNT"
          documentNoLabel="Invoice no."
          counterpartyLabel="Customer"
          refreshKey={refreshKey}
        />
      </div>
    </main>
  );
}
