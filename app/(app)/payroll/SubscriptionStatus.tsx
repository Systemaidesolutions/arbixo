import Link from "next/link";
import { activePayrollEmployees, getPayrollCoverage } from "@/lib/payroll/subscription";
import { monthKey, monthName, tierFor } from "@/lib/payroll/subscriptionTiers";

// ARbixo Payroll subscription status for this month and next (Payroll home
// and Payroll runs). Payroll runs are locked for months that aren't paid, or
// when active employees exceed the paid tier.
export async function PayrollSubscriptionStatus({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [coverage, active] = await Promise.all([getPayrollCoverage(companyId), activePayrollEmployees(companyId)]);
  const now = monthKey(new Date());
  const months = [now, now + 1].map((k) => ({ k, tier: coverage.get(k) }));
  const thisMonth = months[0];
  const ok = thisMonth.tier != null && thisMonth.tier >= active;

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${ok ? "border-neutral-200 bg-white/70 text-neutral-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">ARbixo Payroll subscription</span>
          <span className="ml-2 text-xs">{active} active payroll employee(s)</span>
        </div>
        {!isAdmin && (
          <Link href="/subscription/payments" className="text-xs font-medium text-brand-blue hover:underline">
            Subscription payments
          </Link>
        )}
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {months.map(({ k, tier }) => (
          <li key={k}>
            {monthName(k)}:{" "}
            {tier == null ? (
              <span className="font-medium text-red-600">not subscribed</span>
            ) : tier < active ? (
              <span className="font-medium text-red-600">paid up to {tier} employees, needs the {tierFor(active)}-employee tier</span>
            ) : (
              <span className="font-medium text-green-700">paid, up to {tier} employees</span>
            )}
          </li>
        ))}
      </ul>
      {!ok && (
        <p className="mt-1 text-xs">
          Payroll runs for an unpaid month can&apos;t be created, edited or posted.
          {isAdmin ? " (You're an admin, so you aren't blocked.)" : " A Manager can subscribe under Subscription payments."}
        </p>
      )}
    </div>
  );
}
