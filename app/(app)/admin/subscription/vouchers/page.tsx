import { requireAdmin } from "@/lib/currentUser";
import { VouchersClient } from "./VouchersClient";

export default async function VouchersPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Vouchers</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Single-use discount codes redeemed on the subscription payment page. Codes are random so they
        can&apos;t be guessed.
      </p>
      <VouchersClient />
    </main>
  );
}
