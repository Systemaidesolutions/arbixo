import { redirect } from "next/navigation";
import { getCurrentUserRecord, getCurrentCapability, effectiveCompanyId } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";
import { SubscriptionPaymentsSection } from "./SubscriptionPaymentsSection";

export default async function SubscriptionPaymentsPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const isAdmin = user.role === "ADMIN" && !getAdminActingAsCompanyId();
  const companyId = await effectiveCompanyId();
  const cap = await getCurrentCapability();
  const isManager = !!companyId && !!cap?.canApprove;
  if (!isAdmin && !isManager) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Subscription payments</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {isAdmin
          ? "All subscription payments. Verify a payment to activate that month for the company."
          : "Renew below and an administrator will verify your payment before the month is activated."}
      </p>
      <SubscriptionPaymentsSection showRenew={!isAdmin} />
    </main>
  );
}
