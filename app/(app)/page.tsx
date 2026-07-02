import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ShoppingCart,
  ShoppingBag,
  ArrowDownToLine,
  ArrowUpToLine,
  NotebookPen,
  BarChart3,
  Wallet,
  Landmark,
  CreditCard,
  TrendingUp,
  PiggyBank,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { getCurrentCompany, getCurrentUserRecord } from "@/lib/currentUser";
import { getDashboardSummary, type DashboardMetric } from "@/lib/reports";
import {
  REGISTRATION_TYPE_LABELS,
} from "@/lib/company";

function peso(n: number): string {
  const s = Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-₱" : "₱"}${s}`;
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

function StatTile({
  icon: Icon,
  iconClass,
  label,
  metric,
  sub,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  metric: DashboardMetric;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon size={18} />
      </div>
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-white">{peso(metric.value)}</div>
      <div className="text-xs text-white/50">{sub}</div>
      <div className="mt-1">
        <ChangeBadge pct={metric.changePct} />
      </div>
    </div>
  );
}

const QUICK_ACTIONS: Array<{ href: string; label: string; icon: LucideIcon; iconClass: string }> = [
  { href: "/transactions/sales", label: "New Sale", icon: ShoppingCart, iconClass: "text-brand-green" },
  { href: "/transactions/purchases", label: "New Purchase", icon: ShoppingBag, iconClass: "text-brand-blue" },
  { href: "/transactions/cash-receipts", label: "Cash Receipt", icon: ArrowDownToLine, iconClass: "text-brand-green" },
  { href: "/transactions/cash-disbursement", label: "Cash Disbursement", icon: ArrowUpToLine, iconClass: "text-red-500" },
  { href: "/transactions/general-journal", label: "Journal Entry", icon: NotebookPen, iconClass: "text-purple-500" },
  { href: "/reports/trial-balance", label: "Reports", icon: BarChart3, iconClass: "text-brand-blue" },
];

export default async function HomePage() {
  const user = await getCurrentUserRecord();
  if (user?.role === "ADMIN") {
    redirect("/admin");
  }

  const company = await getCurrentCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/arbixo-logo.jpg"
            alt="Arbixo"
            width={480}
            height={269}
            priority
            className="h-auto w-full max-w-xs"
          />
        </div>
        <div className="mx-auto mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm text-amber-900">
            No company has been assigned to your account yet. Please contact your Arbixo
            administrator to have your company set up — the rest of the app unlocks once it is.
          </p>
        </div>
      </main>
    );
  }

  const summary = await getDashboardSummary(company.id);

  const address = [company.businessAddress, company.zipCode].filter(Boolean).join(", ");
  const info: Array<[string, string]> = [
    ["TIN", company.tin],
    ["Registration", REGISTRATION_TYPE_LABELS[company.registrationType]],
    ["Address", address],
    ["RDO", company.rdoCode],
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-col items-center">
        <Image
          src="/arbixo-logo.jpg"
          alt="Arbixo — Accounting Intelligence. Business Excellence."
          width={480}
          height={269}
          priority
          className="h-auto w-full max-w-[280px]"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Company information */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Company Information
          </div>
          <h2 className="mt-1 text-xl font-semibold text-brand-navy">{company.tradeName}</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            {info.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[92px_1fr] gap-2">
                <dt className="text-neutral-400">{label}</dt>
                <dd className="text-neutral-800">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <a
            href="/company/setup"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline"
          >
            View company details <ArrowRight size={14} />
          </a>
        </section>

        {/* Quick actions */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Quick Actions
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 p-4 text-center transition-colors hover:border-brand-blue/40 hover:bg-neutral-50"
              >
                <a.icon size={22} className={a.iconClass} />
                <span className="text-xs font-medium text-neutral-600">{a.label}</span>
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* At a glance */}
      <section className="mt-6 rounded-xl bg-gradient-to-br from-brand-navy to-[#0e3a63] p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/60">At a Glance</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile
            icon={Wallet}
            iconClass="bg-emerald-500/20 text-emerald-300"
            label="Total Cash"
            metric={summary.totalCash}
            sub="Current Balance"
          />
          <StatTile
            icon={Landmark}
            iconClass="bg-sky-500/20 text-sky-300"
            label="Accounts Receivable"
            metric={summary.accountsReceivable}
            sub="Total Outstanding"
          />
          <StatTile
            icon={CreditCard}
            iconClass="bg-purple-500/20 text-purple-300"
            label="Accounts Payable"
            metric={summary.accountsPayable}
            sub="Total Payables"
          />
          <StatTile
            icon={TrendingUp}
            iconClass="bg-brand-green/20 text-emerald-300"
            label="Gross Sales"
            metric={summary.grossSales}
            sub="This Month"
          />
          <StatTile
            icon={PiggyBank}
            iconClass="bg-amber-500/20 text-amber-300"
            label="Net Profit"
            metric={summary.netProfit}
            sub="This Month"
          />
        </div>
      </section>
    </main>
  );
}
