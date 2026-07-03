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
  Link2,
  type LucideIcon,
} from "lucide-react";
import { getCurrentCompany, getCurrentUserRecord } from "@/lib/currentUser";
import { getDashboardSummary, type DashboardMetric } from "@/lib/reports";
import { getDisplayLinks } from "@/lib/relatedLinks";
import { subscriptionStatus } from "@/lib/subscription";

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
  if (!user) {
    redirect("/login");
  }
  if (user.role === "ADMIN") {
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
  const relatedLinks = await getDisplayLinks();

  // Time-of-day greeting, Philippine time (UTC+8, no DST).
  const phHour = (new Date().getUTCHours() + 8) % 24;
  const greeting = phHour < 12 ? "Good morning" : phHour < 18 ? "Good afternoon" : "Good evening";
  const displayName = user.name?.trim() || user.email.split("@")[0];
  const monthLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  });

  const sub = subscriptionStatus(company.subscriptionEndsAt);
  const subEndsOn = company.subscriptionEndsAt
    ? new Date(company.subscriptionEndsAt).toISOString().slice(0, 10)
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      {(sub.state === "expiring" || sub.state === "expired" || sub.state === "none") && (
        <div
          className={`mt-6 rounded-lg border p-4 text-sm ${
            sub.state === "expiring"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {sub.state === "expiring" ? (
            <>
              Your subscription ends on <strong>{subEndsOn}</strong> ({sub.daysLeft} day
              {sub.daysLeft === 1 ? "" : "s"} left). Please contact your administrator to renew.
            </>
          ) : sub.state === "expired" ? (
            <>
              Your subscription expired on <strong>{subEndsOn}</strong>. You can still view your data,
              but new transactions can&apos;t be posted until it&apos;s renewed — contact your
              administrator.
            </>
          ) : (
            <>
              Your company doesn&apos;t have an active subscription. You can view your data, but new
              transactions can&apos;t be posted until an administrator subscribes.
            </>
          )}
        </div>
      )}

      {/* Financial snapshot — greeting + key figures, at the top */}
      <section className="mt-6 rounded-xl bg-gradient-to-br from-brand-navy to-[#0e3a63] p-5 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {greeting}, {displayName} 👋
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Here&apos;s your financial snapshot for {monthLabel}.
            </p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Financial Snapshot
          </span>
        </div>
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

      {/* Quick actions (below the snapshot) + company information */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Quick actions */}
        <section className="rounded-xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
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

        {/* Related links */}
        <section className="rounded-xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Related Links
          </div>
          {relatedLinks.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">
              No links yet. Your administrator can add helpful links (BIR, tax calculators, etc.)
              here.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {relatedLinks.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 p-4 text-center transition-colors hover:border-brand-blue/40 hover:bg-neutral-50"
                >
                  {l.hasLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/related-links/${l.id}/logo`}
                      alt=""
                      className="h-8 w-8 object-contain"
                    />
                  ) : (
                    <Link2 size={22} className="text-brand-blue" />
                  )}
                  <span className="w-full truncate text-xs font-medium text-neutral-600">
                    {l.name}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
