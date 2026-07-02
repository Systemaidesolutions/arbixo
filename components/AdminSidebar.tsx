"use client";

import { usePathname } from "next/navigation";
import { Building2, Users, SlidersHorizontal, LayoutDashboard, type LucideIcon } from "lucide-react";
import { ADMIN_NAV } from "@/lib/adminNavigation";

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/companies": Building2,
  "/admin/users": Users,
  "/admin/setup": SlidersHorizontal,
};

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-4 ml-4 mt-4 flex h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <div className="text-sm font-semibold text-brand-navy">ARbixo Admin</div>
        <div className="text-sm text-neutral-400">Manage subscribers</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {ADMIN_NAV.map((link) => {
            const Icon = ICONS[link.href] ?? LayoutDashboard;
            // Exact match for the overview root, prefix match for the rest,
            // so /admin/users highlights "User list" and not "Overview".
            const active =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-base font-medium transition-colors ${
                    active
                      ? "bg-brand-navy text-white shadow-sm"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
