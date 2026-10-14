import { requireAdmin } from "@/lib/currentUser";
import { BusinessProfileClient } from "./BusinessProfileClient";

export default async function BusinessProfilePage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Business profile</h1>
      <p className="mt-1 text-sm text-neutral-500">
        ARbixo&apos;s own BIR-registered details — printed as the seller on subscription invoices issued to
        subscribers when you verify a payment. Fill in the ATP details from your actual Authority to Print
        before the first real invoice goes out.
      </p>
      <BusinessProfileClient />
    </main>
  );
}
