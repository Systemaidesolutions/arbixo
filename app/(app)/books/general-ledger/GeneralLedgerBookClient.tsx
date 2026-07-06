"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { JournalType } from "@prisma/client";

const JOURNAL_LABELS: Record<JournalType, string> = {
  CASH_DISBURSEMENT: "CDJ",
  CASH_RECEIPT: "CRJ",
  SALES_ON_ACCOUNT: "SJ",
  PURCHASE_ON_ACCOUNT: "PJ",
  GENERAL_JOURNAL: "GJ",
};

type GLEntry = {
  postingDate: string;
  documentNo: string;
  journalType: JournalType;
  particulars: string | null;
  counterparty: string | null;
  debit: number;
  credit: number;
  balance: number;
};
type GLAccount = {
  code: string;
  title: string;
  classification: string;
  beginningBalance: number;
  entries: GLEntry[];
  totalDebit: number;
  totalCredit: number;
  endingBalance: number;
};
type Data = { accounts: GLAccount[]; totalDebit: number; totalCredit: number };

function monthDefaults() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`, to: now.toISOString().slice(0, 10) };
}

export function GeneralLedgerBookClient({ registeredName }: { registeredName: string }) {
  const def = useMemo(monthDefaults, []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/books/general-ledger?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => active && setData(j))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";
  const bal = (n: number) => `${formatPeso(Math.abs(n))} ${n < 0 ? "Cr" : "Dr"}`;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">General Ledger</h1>
      <p className="mt-1 text-sm text-neutral-500">{registeredName}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 print:hidden">
        <label className="text-xs text-neutral-500">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <label className="text-xs text-neutral-500">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
        </label>
        <button onClick={() => window.print()} className="ml-auto rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Print</button>
      </div>

      <p className="mt-3 text-xs text-neutral-400">Covering {from} to {to}. Balance shown debit (Dr) / credit (Cr).</p>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : data.accounts.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">No account activity in this period.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {data.accounts.map((acc) => (
            <div key={acc.code} className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between bg-neutral-50 px-3 py-2">
                <div className="text-sm font-medium text-neutral-800">
                  <span className="font-mono text-neutral-400">{acc.code}</span> {acc.title}
                </div>
                <div className="text-xs text-neutral-500">Beginning: <span className="font-mono">{bal(acc.beginningBalance)}</span></div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-3 py-1.5">Date</th>
                    <th className="px-3 py-1.5">Doc No.</th>
                    <th className="px-3 py-1.5">Jrnl</th>
                    <th className="px-3 py-1.5">Particulars</th>
                    <th className="px-3 py-1.5 text-right">Debit</th>
                    <th className="px-3 py-1.5 text-right">Credit</th>
                    <th className="px-3 py-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {acc.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-xs">{e.postingDate.slice(0, 10)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{e.documentNo}</td>
                      <td className="px-3 py-1.5 text-xs text-neutral-400">{JOURNAL_LABELS[e.journalType]}</td>
                      <td className="max-w-[240px] truncate px-3 py-1.5 text-xs text-neutral-500" title={e.particulars ?? e.counterparty ?? ""}>
                        {e.particulars ?? e.counterparty ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{e.debit ? formatPeso(e.debit) : ""}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{e.credit ? formatPeso(e.credit) : ""}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-neutral-600">{bal(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-50 text-xs font-medium">
                    <td className="px-3 py-1.5" colSpan={4}>Total — ending {bal(acc.endingBalance)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatPeso(acc.totalDebit)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatPeso(acc.totalCredit)}</td>
                    <td className="px-3 py-1.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium">
            <div className="flex justify-between">
              <span>Grand total (period movement)</span>
              <span className="font-mono">Dr {formatPeso(data.totalDebit)} · Cr {formatPeso(data.totalCredit)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
