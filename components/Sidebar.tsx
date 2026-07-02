"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Repeat,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { NAV_SECTIONS, ADMIN_NAV_SECTIONS, type NavSection } from "@/lib/navigation";

const ICONS: Record<NavSection["icon"], LucideIcon> = {
  settings: Settings,
  transactions: Repeat,
  reports: BarChart3,
  admin: ShieldCheck,
};

const COLLAPSE_KEY = "arbixo:sidebar-collapsed";

export function Sidebar({ role }: { role: "ADMIN" | "USER" }) {
  const pathname = usePathname();
  const sections = role === "ADMIN" ? ADMIN_NAV_SECTIONS : NAV_SECTIONS;
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.title, true]))
  );

  // Remember the collapsed state across visits, same as a real desktop
  // app's docked navigation pane would.
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored) setCollapsed(stored === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <aside
      className={`sticky top-4 ml-4 mt-4 flex h-[calc(100vh-2rem)] shrink-0 flex-col rounded-xl border border-neutral-200 bg-white shadow-sm transition-all ${
        collapsed ? "w-14" : "w-72"
      }`}
    >
      <button
        onClick={toggleCollapsed}
        className="flex items-center justify-center gap-2 border-b border-neutral-100 py-3 text-neutral-400 hover:text-neutral-700"
        title={collapsed ? "Expand menu" : "Collapse menu"}
      >
        {collapsed ? (
          <ChevronRight size={16} />
        ) : (
          <>
            <ChevronLeft size={16} />
            <span className="text-[14px]">Collapse</span>
          </>
        )}
      </button>

      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => {
          const Icon = ICONS[section.icon];
          const isOpen = openSections[section.title];
          const sectionHasActiveLink = section.links.some((l) => l.href === pathname);
          return (
            <div key={section.title} className="px-2">
              <button
                onClick={() => !collapsed && toggleSection(section.title)}
                className={`flex w-full items-center gap-2 rounded px-2 py-2 text-[16px] font-medium hover:bg-neutral-50 ${
                  collapsed ? "justify-center" : "justify-between"
                } ${sectionHasActiveLink ? "text-brand-navy" : "text-neutral-700"}`}
                title={section.title}
              >
                <span className="flex items-center gap-2">
                  <Icon size={18} className="shrink-0 text-brand-navy" />
                  {!collapsed && section.title}
                </span>
                {!collapsed && (
                  <ChevronDown
                    size={15}
                    className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  />
                )}
              </button>

              {!collapsed && isOpen && (
                <ul className="mb-1 ml-6 space-y-0.5 border-l border-neutral-100 pl-2">
                  {section.links.map((link) => {
                    const active = pathname === link.href;
                    return (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className={`block rounded border-l-[3px] px-2 py-1.5 text-[14px] transition-colors ${
                            active
                              ? "border-brand-navy bg-brand-navy/10 font-semibold text-brand-navy"
                              : "border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                          }`}
                        >
                          {link.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
