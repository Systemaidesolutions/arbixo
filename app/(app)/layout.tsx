import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";
import { brandingFlags } from "@/lib/branding";
import { AppShell } from "@/components/AppShell";
import type { SessionPayload } from "@/lib/auth";
import type { SubscriberSubtype } from "@prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts already redirects requests with no valid session token to
  // /login. This second check hits the database so it also catches accounts
  // that were disabled or deleted *after* their session token was issued —
  // the stateless JWT itself can't know that. Runs once per navigation.
  // Fetch the user record and branding flags together — they're independent.
  const [record, branding] = await Promise.all([getCurrentUserRecord(), brandingFlags()]);
  if (!record || record.isDisabled) {
    redirect("/login");
  }

  // A company disabled after the session was issued kicks its users out on
  // their next navigation (a lapsed subscription does not). We also grab the
  // trade name here to show in the header. An admin acting inside a company
  // (lib/adminActingAs.ts) gets the same treatment EXCEPT the disabled
  // check — support access shouldn't be blocked by the very thing they
  // might be there to help fix.
  let companyName: string | null = null;
  let hasCompanyLogo = false;
  let actingAsCompanyName: string | null = null;

  if (record.role === "USER" && record.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: record.companyId },
      select: { isActive: true, tradeName: true, logoUrl: true },
    });
    if (company && !company.isActive) {
      redirect("/login");
    }
    companyName = company?.tradeName ?? null;
    hasCompanyLogo = !!company?.logoUrl;
  } else if (record.role === "ADMIN") {
    const actingAsCompanyId = getAdminActingAsCompanyId();
    if (actingAsCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: actingAsCompanyId },
        select: { tradeName: true, logoUrl: true },
      });
      if (company) {
        companyName = company.tradeName;
        hasCompanyLogo = !!company.logoUrl;
        actingAsCompanyName = company.tradeName;
      }
    }
  }

  const user: SessionPayload = { sub: record.id, email: record.email, role: record.role };

  // For nav/capability purposes, an admin acting inside a company presents
  // exactly like that company's own Manager — see getCurrentCapability in
  // lib/currentUser.ts for the same logic applied server-side to API routes.
  const effectiveRole: "ADMIN" | "USER" = actingAsCompanyName ? "USER" : record.role;
  const effectiveSubtype: SubscriberSubtype | null = actingAsCompanyName ? "MANAGER" : record.subscriberSubtype;

  return (
    <AppShell
      user={user}
      role={effectiveRole}
      subtype={effectiveSubtype}
      branding={branding}
      companyName={companyName}
      userName={record.name}
      hasPhoto={!!record.photoUrl}
      hasCompanyLogo={hasCompanyLogo}
      actingAsCompanyName={actingAsCompanyName}
    >
      {children}
    </AppShell>
  );
}
