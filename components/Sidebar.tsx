"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Headphones,
  X,
  Building2,
  ReceiptText,
  ListTree,
  Users,
  ArrowDownToLine,
  ArrowUpToLine,
  ShoppingCart,
  ShoppingBag,
  NotebookPen,
  Scale,
  BookText,
  BookUser,
  LineChart,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import type { SubscriberSubtype } from "@prisma/client";
import { NAV_SECTIONS, ADMIN_NAV_SECTIONS, type NavIcon, type NavSection } from "@/lib/navigation";
import { capabilitiesFor } from "@/lib/permissions";

const REVIEW_SECTION: NavSection = {
  title: "Review",
  icon: "admin",
  links: [{ href: "/approvals", label: "Pending approvals", icon: "approvals" }],
};

// Builds the nav a subscriber sees based on their subtype: Report Creator
// (read-only) loses the Transactions section; a Manager gains Approvals.
function sectionsFor(role: "ADMIN" | "USER", subtype: SubscriberSubtype | null): NavSection[] {
  if (role === "ADMIN") return ADMIN_NAV_SECTIONS;
  const cap = capabilitiesFor(role, subtype);
  let sections = NAV_SECTIONS;
  if (!cap.canPost) {
    sections = sections.filter((s) => s.title !== "Transactions");
  }
  if (cap.canApprove) {
    sections = [...sections, REVIEW_SECTION];
  }
  return sections;
}

const LINK_ICONS: Record<NavIcon, LucideIcon> = {
  company: Building2,
  tax: ReceiptText,
  accounts: ListTree,
  parties: Users,
  cashOut: ArrowDownToLine,
  cashIn: ArrowUpToLine,
  sales: ShoppingCart,
  purchases: ShoppingBag,
  journal: NotebookPen,
  trialBalance: Scale,
  generalLedger: BookText,
  subsidiary: BookUser,
  income: LineChart,
  balance: FileBarChart2,
  vat: FileText,
  dashboard: LayoutDashboard,
  users: Users,
  companies: Building2,
  approvals: ClipboardCheck,
};

function NavList({
  sections,
  pathname,
  openSections,
  toggleSection,
}: {
  sections: NavSection[];
  pathname: string;
  openSections: Record<string, boolean>;
  toggleSection: (title: string) => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section) => {
        const isOpen = openSections[section.title];
        return (
          <div key={section.title} className="mb-2">
            <button
              onClick={() => toggleSection(section.title)}
              className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#8ea6c8] hover:text-white"
            >
              {section.title}
              <ChevronDown
                size={14}
                className={`transition-transform ${isOpen ? "" : "-rotate-90"}`}
              />
            </button>

            {isOpen && (
              <ul className="mt-1 space-y-0.5">
                {section.links.map((link) => {
                  const Icon = LINK_ICONS[link.icon];
                  const active = pathname === link.href;
                  return (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-gradient-to-r from-brand-blue to-[#1668c9] font-medium text-white shadow-sm"
                            : "text-[#c9d6ea] hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon
                          size={17}
                          className={`shrink-0 ${active ? "text-white" : "text-brand-blue"}`}
                        />
                        <span className="min-w-0">{link.label}</span>
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
  );
}

function HelpCard() {
  return (
    <div className="m-3 rounded-xl bg-white/5 p-4 text-center ring-1 ring-white/10">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/20">
        <Headphones size={18} className="text-brand-blue" />
      </div>
      <p className="mt-2 text-sm font-medium text-white">Need help?</p>
      <p className="text-xs text-white/60">We're here to assist you.</p>
      <a
        href="mailto:info.systemaidesolutions@gmail.com"
        className="mt-3 inline-block rounded-lg bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
      >
        Contact Support
      </a>
    </div>
  );
}

export function Sidebar({
  role,
  subtype = null,
  mobileOpen = false,
  onCloseMobile,
}: {
  role: "ADMIN" | "USER";
  subtype?: SubscriberSubtype | null;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const sections = sectionsFor(role, subtype);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.title, true]))
  );

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <>
      {/* Desktop: docked, flush, full-height dark pane. Hidden below lg. */}
      <aside className="hidden w-64 shrink-0 flex-col bg-brand-navy lg:flex">
        <NavList
          sections={sections}
          pathname={pathname}
          openSections={openSections}
          toggleSection={toggleSection}
        />
        <HelpCard />
      </aside>

      {/* Mobile/tablet: off-canvas dark drawer over a backdrop. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} aria-hidden />
          <aside className="absolute left-0 top-0 flex h-full w-64 max-w-[85vw] flex-col bg-brand-navy shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-medium text-white">Menu</span>
              <button
                onClick={onCloseMobile}
                aria-label="Close menu"
                className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <NavList
              sections={sections}
              pathname={pathname}
              openSections={openSections}
              toggleSection={toggleSection}
            />
            <HelpCard />
          </aside>
        </div>
      )}
    </>
  );
}
