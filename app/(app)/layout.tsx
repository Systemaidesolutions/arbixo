import { redirect } from "next/navigation";
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

  const user: SessionPayload = { sub: record.id, email: record.email, role: record.role };

  return (
    <AppShell user={user} role={record.role}>
      {children}
    </AppShell>
  );
}
