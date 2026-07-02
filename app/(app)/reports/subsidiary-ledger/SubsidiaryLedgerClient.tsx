"use client";

import { useEffect, useState } from "react";
import type { Customer, Vendor } from "@prisma/client";

type SubsidiaryLedgerRow = {
  id: string;
  entryNo: number;
  postingDate: string;
  journalType: string;
  documentNo: string;
  accountCode: string;
  accountTitle: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
};

function formatBalance(n: number) {
  return `${Math.abs(n).toFixed(2)} ${n >= 0 ? "Dr" : "Cr"}`;
}

function partyName(p: { tradeName: string; firstName?: string | null; lastName?: string | null }) {
  return p.tradeName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
}

export function SubsidiaryLedgerClient({
  companyId,
  customers,
  vendors,
}: {
  companyId: string;
  customers: Customer[];
  vendors: Vendor[];
}) {
  const [partyType, setPartyType] = useState<"CUSTOMER" | "VENDOR">("CUSTOMER");
  const parties = partyType === "CUSTOMER" ? customers : vendors;
  const [partyId, setPartyId] = useState(parties[0]?.id ?? "");
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [endingBalance, setEndingBalance] = useState(0);
  const [rows, setRows] = useState<SubsidiaryLedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchPartyType(type: "CUSTOMER" | "VENDOR") {
    setPartyType(type);
    const list = type === "CUSTOMER" ? customers : vendors;
    setPartyId(list[0]?.id ?? "");
  }

  async function load() {
    if (!partyId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ companyId, partyType, partyId, dateFrom, dateTo });
    const res = await fetch(`/api/reports/subsidiary-ledger?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load ledger.");
      return;
    }
    setBeginningBalance(data.beginningBalance);
    setEndingBalance(data.endingBalance);
    setRows(data.rows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType, partyId, dateFrom, dateTo]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">
        {partyType === "CUSTOMER" ? "Debtors' ledger" : "Creditors' ledger"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        A single {partyType === "CUSTOMER" ? "customer's" : "vendor's"} Accounts{" "}
        {partyType === "CUSTOMER" ? "Receivable" : "Payable"} movements — not every line tagged
        with them, just what affects what they {partyType === "CUSTOMER" ? "owe" : "are owed"}.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4">
        <label className="text-xs text-neutral-500">
          Type
          <select
            value={partyType}
            onChange={(e) => switchPartyType(e.target.value as "CUSTOMER" | "VENDOR")}
            className={`mt-1 block ${field}`}
          >
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          {partyType === "CUSTOMER" ? "Customer" : "Vendor"}
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className={`mt-1 block ${field}`}>
            {parties.length === 0 && <option value="">None yet</option>}
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {partyName(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Journal</th>
              <th className="px-3 py-2 text-left">Doc no.</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <tr className="bg-neutral-50/50">
              <td colSpan={6} className="px-3 py-2 text-xs font-medium text-neutral-500">
                Beginning balance
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-medium text-neutral-500">
                {formatBalance(beginningBalance)}
              </td>
            </tr>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-neutral-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-neutral-400">
                  No entries for this period
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{new Date(row.postingDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-neutral-500">{row.journalType.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 font-mono">{row.documentNo}</td>
                  <td className="px-3 py-2 text-neutral-500">
                    {row.accountCode} — {row.accountTitle}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{row.debit > 0 ? row.debit.toFixed(2) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.credit > 0 ? row.credit.toFixed(2) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatBalance(row.runningBalance)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
            <tr>
              <td colSpan={6} className="px-3 py-2">
                Ending balance
              </td>
              <td className="px-3 py-2 text-right font-mono">{formatBalance(endingBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}
