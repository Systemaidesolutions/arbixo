import { redirect } from "next/navigation";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { capabilitiesFor } from "@/lib/permissions";
import { PaymentsClient } from "./PaymentsClient";

export default async function SubscriptionPaymentsPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");
  const isAdmin = user.role === "ADMIN";
  const isManager = user.role === "USER" && capabilitiesFor(user.role, user.subscriberSubtype).canApprove;
  if (!isAdmin && !isManager) redirect("/");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Subscription payments</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {isAdmin
          ? "All subscription payments. Verify a payment to extend that company's subscription by one month."
          : "Your company's subscription payments. Verification is done by an administrator."}
      </p>
      <PaymentsClient />
    </main>
  );
}
