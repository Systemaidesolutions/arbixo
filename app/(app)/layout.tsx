import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { AppShell } from "@/components/AppShell";
import type { SessionPayload } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts already redirects requests with no valid session token to
  // /login. This second check hits the database so it also catches accounts
  // that were disabled or deleted *after* their session token was issued —
  // the stateless JWT itself can't know that. Runs once per navigation.
  const record = await getCurrentUserRecord();
  if (!record || record.isDisabled) {
    redirect("/login");
  }

  // A company disabled after the session was issued kicks its users out on
  // their next navigation (a lapsed subscription does not).
  if (record.role === "USER" && record.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: record.companyId },
      select: { isActive: true },
    });
    if (company && !company.isActive) {
      redirect("/login");
    }
  }

  const user: SessionPayload = { sub: record.id, email: record.email, role: record.role };

  return (
    <AppShell user={user} role={record.role} subtype={record.subscriberSubtype}>
      {children}
    </AppShell>
  );
}
