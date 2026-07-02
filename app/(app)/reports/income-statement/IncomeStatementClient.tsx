"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/format";
import type { IncomeStatement } from "@/lib/reports";

export function IncomeStatementClient({ companyId }: { companyId: string }) {
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ companyId, dateFrom, dateTo });
    const res = await fetch(`/api/reports/income-statement?${params}`);
    const data = await res.json();
    setLoading(false);
    setStatement(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const field = "rounded border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Income statement</h1>
      <p className="mt-1 text-sm text-neutral-500">For the period selected below.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4">
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

      {loading || !statement ? (
        <p className="mt-6 text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Revenue</h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {statement.revenue.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-400">No revenue this period</p>
              ) : (
                statement.revenue.map((l) => (
                  <div key={l.accountId} className="flex justify-between px-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-neutral-400">{l.code}</span> {l.title}
                    </span>
                    <span className="font-mono">{formatPeso(l.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
                <span>Total revenue</span>
                <span className="font-mono">{formatPeso(statement.totalRevenue)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Expenses</h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {statement.expense.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-400">No expenses this period</p>
              ) : (
                statement.expense.map((l) => (
                  <div key={l.accountId} className="flex justify-between px-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-neutral-400">{l.code}</span> {l.title}
                    </span>
                    <span className="font-mono">{formatPeso(l.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between bg-neutral-50 px-3 py-2 text-sm font-medium">
                <span>Total expenses</span>
                <span className="font-mono">{formatPeso(statement.totalExpense)}</span>
              </div>
            </div>
          </section>

          <div
            className={`flex justify-between rounded-lg border px-4 py-3 text-base font-medium ${
              statement.netIncome >= 0
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span>Net {statement.netIncome >= 0 ? "income" : "loss"}</span>
            <span className="font-mono">{formatPeso(Math.abs(statement.netIncome))}</span>
          </div>
        </div>
      )}
    </main>
  );
}
