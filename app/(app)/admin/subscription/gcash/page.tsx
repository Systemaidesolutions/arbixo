import { requireAdmin } from "@/lib/currentUser";
import { GcashClient } from "./GcashClient";

export default async function GcashSetupPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">GCash account</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The GCash account subscribers pay to. A QR is generated from this number on the payment page,
        and it&apos;s shown for direct payment in the GCash app.
      </p>
      <GcashClient />
    </main>
  );
}
