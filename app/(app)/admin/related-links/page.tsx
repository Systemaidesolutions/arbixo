import { requireAdmin } from "@/lib/currentUser";
import { getDisplayLinks } from "@/lib/relatedLinks";
import { RelatedLinksClient } from "./RelatedLinksClient";

export default async function RelatedLinksPage() {
  await requireAdmin();
  const links = await getDisplayLinks();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Related links</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Handy shortcuts shown on every subscriber&apos;s dashboard — e.g. the BIR website, an online
        tax calculator, or SSS / PhilHealth portals. Each link has a name, a URL, and an optional
        logo.
      </p>
      <RelatedLinksClient initialLinks={links} />
    </main>
  );
}
