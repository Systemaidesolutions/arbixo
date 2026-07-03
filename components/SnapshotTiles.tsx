"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Wallet,
  Landmark,
  CreditCard,
  TrendingUp,
  PiggyBank,
  X,
  type LucideIcon,
} from "lucide-react";
import type { DashboardSummary, DashboardBreakdowns } from "@/lib/reports";

function peso(n: number): string {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-white/40">— vs last month</span>;
  }
  const up = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-300" : "text-red-300"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}% vs last month
    </span>
  );
}

type MetricKey = keyof DashboardSummary;

const TILES: { key: MetricKey; icon: LucideIcon; iconClass: string; label: string; sub: string }[] = [
  { key: "totalCash", icon: Wallet, iconClass: "bg-emerald-500/20 text-emerald-300", label: "Total Cash", sub: "Current Balance" },
  { key: "accountsReceivable", icon: Landmark, iconClass: "bg-sky-500/20 text-sky-300", label: "Accounts Receivable", sub: "Total Outstanding" },
  { key: "accountsPayable", icon: CreditCard, iconClass: "bg-purple-500/20 text-purple-300", label: "Accounts Payable", sub: "Total Payables" },
  { key: "grossSales", icon: TrendingUp, iconClass: "bg-brand-green/20 text-emerald-300", label: "Gross Sales", sub: "This Month" },
  { key: "netProfit", icon: PiggyBank, iconClass: "bg-amber-500/20 text-amber-300", label: "Net Profit", sub: "This Month" },
];

export function SnapshotTiles({
  summary,
  breakdowns,
  periodLabel,
}: {
  summary: DashboardSummary;
  breakdowns: DashboardBreakdowns;
  periodLabel: string;
}) {
  const [openKey, setOpenKey] = useState<MetricKey | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = TILES.find((t) => t.key === openKey) ?? null;

  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {TILES.map((t) => {
          const metric = summary[t.key];
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setOpenKey(t.key)}
              className="rounded-xl bg-white/5 p-4 text-left ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              title="Click to see the breakdown"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.iconClass}`}>
                <Icon size={18} />
              </div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/60">{t.label}</div>
              <div className="mt-0.5 text-xl font-semibold text-white">{peso(metric.value)}</div>
              <div className="text-xs text-white/50">{t.sub}</div>
              <div className="mt-1">
                <ChangeBadge pct={metric.changePct} />
              </div>
            </button>
          );
        })}
      </div>

      {mounted && active &&
        createPortal(
          <BreakdownModal
            title={active.label}
            periodLabel={active.key === "grossSales" || active.key === "netProfit" ? periodLabel : "as of today"}
            total={summary[active.key].value}
            lines={breakdowns[active.key]}
            onClose={() => setOpenKey(null)}
          />,
          document.body
        )}
    </>
  );
}

function BreakdownModal({
  title,
  periodLabel,
  total,
  lines,
  onClose,
}: {
  title: string;
  periodLabel: string;
  total: number;
  lines: { code: string | null; title: string; amount: number }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            <p className="text-xs text-neutral-500">{periodLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={18} />
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">No accounts are contributing to this figure yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-2 font-medium">Account</th>
                <th className="py-2 pl-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lines.map((l, i) => (
                <tr key={`${l.code ?? l.title}-${i}`}>
                  <td className="py-1.5 pr-2">
                    {l.code && <span className="mr-2 font-mono text-xs text-neutral-400">{l.code}</span>}
                    <span className="text-neutral-700">{l.title}</span>
                  </td>
                  <td className={`py-1.5 pl-2 text-right font-mono tabular-nums ${l.amount < 0 ? "text-red-600" : "text-neutral-800"}`}>
                    {peso(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 font-semibold">
                <td className="py-2 pr-2 text-neutral-900">Total</td>
                <td className="py-2 pl-2 text-right font-mono tabular-nums text-neutral-900">{peso(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
