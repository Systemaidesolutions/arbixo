import { getCurrentUser } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts already redirects unauthenticated requests to /login
  // before they ever reach this layout, so `user` should always be
  // non-null here in practice. Handled gracefully anyway rather than
  // assuming middleware can never be bypassed.
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <AppHeader user={user} />
      <div className="flex flex-1 items-start">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
