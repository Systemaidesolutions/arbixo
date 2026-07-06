import { requireAdmin } from "@/lib/currentUser";
import { PricingClient } from "./PricingClient";

export default async function SubscriptionPricingPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Subscription pricing</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Dated pricing — the current rate is the newest price whose effective date has arrived. Old
        prices are kept for history.
      </p>
      <PricingClient />
    </main>
  );
}
