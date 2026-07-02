import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/currentUser";
import { Building2, Users, Receipt, ShieldCheck } from "lucide-react";

type Accent = "navy" | "green" | "amber" | "red" | "blue" | "neutral";

const ACCENT: Record<Accent, string> = {
  navy: "text-brand-navy",
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  blue: "text-brand-blue",
  neutral: "text-neutral-700",
};

function Tile({
  label,
  value,
  sub,
  accent = "navy",
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: Accent;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className={`text-2xl font-semibold ${ACCENT[accent]}`}>{value.toLocaleString()}</div>
      <div className="text-xs font-medium text-neutral-600">{label}</div>
      {sub && <div className="text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

/** Per-company record totals across the high-volume tables — a proxy for data size. */
async function companyDataSizes(companyIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>(companyIds.map((id) => [id, 0]));
  if (companyIds.length === 0) return totals;
  const where = { companyId: { in: companyIds } };
  const groups = await Promise.all([
    prisma.ledgerEntry.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
    prisma.auditLog.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
    prisma.account.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
    prisma.customer.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
    prisma.vendor.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
    prisma.employee.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
    prisma.contact.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
    prisma.location.groupBy({ by: ["companyId"], _count: { _all: true }, where }),
  ]);
  for (const arr of groups) {
    for (const g of arr) {
      if (g.companyId) totals.set(g.companyId, (totals.get(g.companyId) ?? 0) + g._count._all);
    }
  }
  return totals;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [companies, totalUsers, activeUsers, unverified, adminCount, totalLedger] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, tradeName: true, subscriptionEndsAt: true, isActive: true },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { isDisabled: false, isVerified: true } }),
    prisma.user.count({ where: { isVerified: false } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.ledgerEntry.count(),
  ]);

  let subscribed = 0;
  let noSubscription = 0;
  let dueForRenewal = 0;
  let expired = 0;
  let disabledCompanies = 0;
  for (const c of companies) {
    if (!c.isActive) disabledCompanies++;
    const e = c.subscriptionEndsAt;
    if (!e) noSubscription++;
    else if (e < now) expired++;
    else {
      subscribed++;
      if (e <= weekAhead) dueForRenewal++;
    }
  }

  const sizes = await companyDataSizes(companies.map((c) => c.id));
  const sizeRows = companies
    .map((c) => ({ name: c.tradeName, count: sizes.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const maxSize = Math.max(1, ...sizeRows.map((r) => r.count));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-brand-navy" />
        <h1 className="text-xl font-medium text-neutral-900">Admin dashboard</h1>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Signed in as {admin.email} (Arbixo admin).</p>

      {/* Subscription overview */}
      <h2 className="mt-8 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        <Building2 size={14} /> Subscriptions
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Subscribed companies" value={subscribed} accent="green" />
        <Tile label="No subscription" value={noSubscription} accent="neutral" />
        <Tile label="Due for renewal" value={dueForRenewal} sub="within 7 days" accent="amber" />
        <Tile label="Expired" value={expired} accent="red" />
        <Tile label="Disabled companies" value={disabledCompanies} accent="red" />
      </div>

      {/* People & activity */}
      <h2 className="mt-8 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        <Users size={14} /> People &amp; activity
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Active users" value={activeUsers} sub="verified &amp; enabled" accent="blue" />
        <Tile label="Total users" value={totalUsers} accent="navy" />
        <Tile label="Unverified accounts" value={unverified} accent="amber" />
        <Tile label="Admins" value={adminCount} accent="navy" />
        <Tile label="Transactions posted" value={totalLedger} accent="navy" />
      </div>

      {/* Company data size */}
      <h2 className="mt-8 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        <Receipt size={14} /> Company data size
        <span className="font-normal normal-case text-neutral-400">(records per company)</span>
      </h2>
      <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
        {sizeRows.length === 0 || maxSize <= 1 ? (
          <p className="text-sm text-neutral-400">No company data yet.</p>
        ) : (
          <div className="space-y-2">
            {sizeRows.map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <div className="w-32 shrink-0 truncate text-sm text-neutral-700 sm:w-44" title={r.name}>
                  {r.name}
                </div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-100">
                  <div
                    className="h-full rounded bg-gradient-to-r from-brand-blue to-brand-green"
                    style={{ width: `${Math.max(2, (r.count / maxSize) * 100)}%` }}
                  />
                </div>
                <div className="w-16 shrink-0 text-right text-sm tabular-nums text-neutral-600">
                  {r.count.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/admin/users"
          className="rounded border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          View user list →
        </a>
        <a
          href="/admin/companies"
          className="rounded border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          View company list →
        </a>
        <a
          href="/utility/audit-trail"
          className="rounded border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Audit trail →
        </a>
      </div>
    </main>
  );
}
