import { redirect } from "next/navigation";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";
import { SUBTYPE_LABELS } from "@/lib/permissions";

type DocLink = { href: string; title: string; description: string };
// Which manual to flag "Your account" — exactly one of these three is true
// for any signed-in user: a plain admin (console mode), an admin currently
// acting as a company (reads as that company's Manager), or a subscriber
// with their own subtype.
type Access = { plainAdmin: boolean; actingAsManager: boolean; subtype: string | null };

const MANUALS: (DocLink & { matches: (a: Access) => boolean })[] = [
  {
    href: "/manuals/ARbixo-User-Manual.docx",
    title: "User Manual",
    description: "Recording transactions, reviewing history, and generating reports.",
    matches: (a) => !a.plainAdmin && !a.actingAsManager && (a.subtype === "USER" || a.subtype === "REPORT_CREATOR" || !a.subtype),
  },
  {
    href: "/manuals/ARbixo-Manager-Manual.docx",
    title: "Manager Manual",
    description: "Everything in the User Manual, plus branches, the audit trail, backups, and subscription payments.",
    matches: (a) => a.actingAsManager || a.subtype === "MANAGER",
  },
  {
    href: "/manuals/ARbixo-Admin-Manual.docx",
    title: "Administrator Manual",
    description: "Running the platform: companies, users, subscriptions, and platform-wide settings.",
    matches: (a) => a.plainAdmin,
  },
];

const LEGAL_DOCS: DocLink[] = [
  {
    href: "/documents/ARbixo-NDA.docx",
    title: "Non-Disclosure Agreement",
    description: "Template NDA for a new client — covers Systemaide's necessary access to Client Data as Platform provider.",
  },
  {
    href: "/documents/ARbixo-Subscription-Agreement.docx",
    title: "Subscription Agreement",
    description: "Template subscription contract — fees, renewal, data handling, and termination terms.",
  },
];

function DocCard({ href, title, description, highlight }: DocLink & { highlight?: boolean }) {
  return (
    <a
      href={href}
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-brand-blue/40 hover:bg-neutral-50 ${
        highlight ? "border-brand-blue/50 bg-blue-50/40" : "border-neutral-200"
      }`}
    >
      <span className="mt-0.5 text-xl">📄</span>
      <span>
        <span className="flex items-center gap-2">
          <span className="font-medium text-neutral-900">{title}</span>
          {highlight && (
            <span className="rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Your account
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-neutral-500">{description}</span>
      </span>
    </a>
  );
}

export default async function ResourcesPage() {
  const user = await getCurrentUserRecord();
  if (!user) redirect("/login");

  const actingAsCompanyId = getAdminActingAsCompanyId();
  const access: Access = {
    plainAdmin: user.role === "ADMIN" && !actingAsCompanyId,
    actingAsManager: user.role === "ADMIN" && !!actingAsCompanyId,
    subtype: user.subscriberSubtype,
  };
  const isAdmin = access.plainAdmin;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="text-xl font-medium text-neutral-900">Documents</h1>
      <p className="mt-1 text-sm text-neutral-500">Manuals and reference documents for ARbixo, ready to download.</p>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Manuals</h2>
        <div className="mt-3 space-y-2">
          {MANUALS.map((m) => (
            <DocCard key={m.href} {...m} highlight={m.matches(access)} />
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Legal templates</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Admin only — fill-in-the-blank templates for onboarding a new client. Have these reviewed by a lawyer
            before real use.
          </p>
          <div className="mt-3 space-y-2">
            {LEGAL_DOCS.map((d) => (
              <DocCard key={d.href} {...d} />
            ))}
          </div>
        </section>
      )}

      {!isAdmin && user.subscriberSubtype && (
        <p className="mt-6 text-xs text-neutral-400">
          Signed in as {SUBTYPE_LABELS[user.subscriberSubtype]}. The manual marked "Your account" matches your access
          level, but you're welcome to check the others too.
        </p>
      )}
    </main>
  );
}
