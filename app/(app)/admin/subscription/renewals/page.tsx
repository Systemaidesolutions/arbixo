import { requireAdmin } from "@/lib/currentUser";
import { RenewalsClient } from "./RenewalsClient";

export default async function RenewalsPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Renewals</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Renew any company&apos;s subscription in one place. Renewing extends it by one month at the
        current price and records a verified payment.
      </p>
      <RenewalsClient />
    </main>
  );
}
