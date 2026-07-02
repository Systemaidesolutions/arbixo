import { AppHeader } from "@/components/AppHeader";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Redirects non-admins; middleware also blocks /admin at the edge.
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <AppHeader user={user} />
      <div className="flex flex-1 items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
