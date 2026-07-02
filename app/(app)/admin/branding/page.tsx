import { requireAdmin } from "@/lib/currentUser";
import { brandingFlags } from "@/lib/branding";
import { BrandingClient } from "./BrandingClient";

export default async function BrandingPage() {
  await requireAdmin();
  const flags = await brandingFlags();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Branding</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Upload the app&apos;s brand images. These apply across the whole instance and take effect
        immediately. Keep each image under ~1.5&nbsp;MB.
      </p>
      <BrandingClient flags={flags} />
    </main>
  );
}
