import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/currentUser";
import { cleanDenied } from "@/lib/userPermissions";
import { SUBTYPE_LABELS } from "@/lib/permissions";
import { UserAccessClient, type AccessRow } from "./UserAccessClient";

export const dynamic = "force-dynamic";

// Admin › User access: per-user Accounting access groups. New users get
// everything; the admin unticks what a user shouldn't do.
export default async function UserAccessPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true, email: true, name: true, subscriberSubtype: true, isDisabled: true, deniedPermissions: true, require2fa: true, totpEnabled: true,
      company: { select: { tradeName: true } },
    },
    orderBy: { email: "asc" },
  });

  const rows: AccessRow[] = users
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      type: u.subscriberSubtype ? SUBTYPE_LABELS[u.subscriberSubtype] : "—",
      company: u.company?.tradeName ?? "(no company)",
      isDisabled: u.isDisabled,
      denied: cleanDenied(u.deniedPermissions),
      require2fa: u.require2fa,
      has2fa: u.totpEnabled,
    }))
    .sort((a, b) => a.company.localeCompare(b.company) || a.email.localeCompare(b.email));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">User access</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500">
        Choose what each subscriber can do in the Accounting app. New users get full access; untick a box to remove it.
        Changes apply on the user&apos;s next page load. Admins always have full access. The user type (Manager, User,
        Report Creator) still applies on top of this: for example, a Report Creator can&apos;t do transactions even when
        that box is ticked. <b>Require 2FA</b> makes the user sign in with an authenticator code every time; if they
        haven&apos;t set one up, they&apos;re walked through it on their next sign-in.
      </p>
      <UserAccessClient rows={rows} />
    </main>
  );
}
