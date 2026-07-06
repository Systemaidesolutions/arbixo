"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  X,
  Building2,
  ReceiptText,
  ListTree,
  Users,
  ArrowDownToLine,
  ArrowUpToLine,
  ShoppingCart,
  ShoppingBag,
  Ship,
  NotebookPen,
  Scale,
  BookText,
  BookUser,
  LineChart,
  FileBarChart2,
  FileText,
  FileSpreadsheet,
  LayoutDashboard,
  ClipboardCheck,
  ScrollText,
  Database,
  Palette,
  Link2,
  Truck,
  Briefcase,
  Contact,
  Coins,
  Ticket,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SubscriberSubtype } from "@prisma/client";
import {
  NAV_SECTIONS,
  ADMIN_NAV_SECTIONS,
  HISTORY_SECTION,
  type NavIcon,
  type NavSection,
} from "@/lib/navigation";
import { capabilitiesFor } from "@/lib/permissions";
import { usePageStack } from "@/components/PageStack";

const REVIEW_SECTION: NavSection = {
  title: "Review",
  icon: "admin",
  links: [{ href: "/approvals", label: "Pending approvals", icon: "approvals" }],
};

const COMPANY_BACKUP_LINK = { href: "/utility/backup", label: "Backup this company", icon: "backup" } as const;
const SUBSCRIPTION_PAYMENTS_LINK = { href: "/subscription/payments", label: "Subscription payments", icon: "payments" } as const;

// Builds the nav a subscriber sees based on their subtype: Report Creator
// (read-only) loses the Transactions section; a Manager gains the History
// group (ledger browsers + audit trail), a company-backup option in Setup,
// and Approvals.
function sectionsFor(role: "ADMIN" | "USER", subtype: SubscriberSubtype | null): NavSection[] {
  if (role === "ADMIN") return ADMIN_NAV_SECTIONS;
  const cap = capabilitiesFor(role, subtype);
  let sections = NAV_SECTIONS;
  if (!cap.canPost) {
    sections = sections.filter((s) => s.title !== "Transactions");
  }
  if (!cap.canApprove) return sections;

  // Managers: History group before Setup, a company-backup link inside Setup,
  // and Approvals at the end.
  const managerSections: NavSection[] = [];
  for (const s of sections) {
    if (s.title === "Setup") {
      managerSections.push(HISTORY_SECTION);
      managerSections.push({ ...s, links: [...s.links, COMPANY_BACKUP_LINK, SUBSCRIPTION_PAYMENTS_LINK] });
    } else {
      managerSections.push(s);
    }
  }
  return [...managerSections, REVIEW_SECTION];
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
  importations: Ship,
  journal: NotebookPen,
  trialBalance: Scale,
  generalLedger: BookText,
  subsidiary: BookUser,
  income: LineChart,
  balance: FileBarChart2,
  vat: FileText,
  withholding: FileSpreadsheet,
  dashboard: LayoutDashboard,
  users: Users,
  companies: Building2,
  approvals: ClipboardCheck,
  audit: ScrollText,
  backup: Database,
  branding: Palette,
  links: Link2,
  pricing: Coins,
  voucher: Ticket,
  payments: Wallet,
  gcash: Wallet,
  customers: Users,
  vendors: Truck,
  employees: Briefcase,
  contacts: Contact,
};

function SidebarBrand() {
  return (
    <div className="mx-4 mb-4 mt-2 rounded-2xl bg-white p-2.5 text-center shadow-lg ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/arbixo-logo.jpg"
        alt="ARbixo — Accounting Intelligence. Business Excellence."
        className="mx-auto w-full max-w-[130px]"
      />
      <p className="mt-1 text-[9px] text-neutral-500">Powered by: Systemaide Solutions Inc.</p>
    </div>
  );
}

// Sections whose links open as stacked overlay pages (BC-style) rather than a
// full navigation. Starting with Transactions; links inside a stacked page then
// go deeper automatically (see EmbedLinkInterceptor).
const STACKABLE_SECTIONS = new Set(["Transactions"]);

function NavList({
  sections,
  pathname,
  openSections,
  toggleSection,
  dashboardHref,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  openSections: Record<string, boolean>;
  toggleSection: (title: string) => void;
  dashboardHref: string;
  onNavigate?: () => void;
}) {
  const dashActive = pathname === dashboardHref;
  const pageStack = usePageStack();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {/* Prominent Dashboard button at the top of the nav pane. */}
      <a
        href={dashboardHref}
        className={`mb-3 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          dashActive
            ? "bg-gradient-to-r from-brand-blue to-[#1668c9] text-white shadow-sm"
            : "bg-white/5 text-white hover:bg-white/10"
        }`}
      >
        <LayoutDashboard size={17} className={dashActive ? "text-white" : "text-brand-blue"} />
        Dashboard
      </a>

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
                  const stackable = pageStack && STACKABLE_SECTIONS.has(section.title);
                  return (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={(e) => {
                          if (stackable) {
                            e.preventDefault();
                            pageStack!.open(link.href, link.label);
                          }
                          onNavigate?.();
                        }}
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
  const dashboardHref = role === "ADMIN" ? "/admin" : "/";
  const storageKey = `arbixo:navOpen:${role}`;

  // Groups start collapsed (headers only). The user's expand/collapse choices
  // are remembered across sessions in localStorage. Server + first client
  // render both use the collapsed default to avoid a hydration mismatch; saved
  // state is applied on mount.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.title, false]))
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      setOpenSections((prev) => {
        const next = { ...prev };
        for (const s of sections) {
          if (typeof saved[s.title] === "boolean") next[s.title] = saved[s.title];
        }
        return next;
      });
    } catch {
      // ignore malformed / unavailable storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function toggleSection(title: string) {
    setOpenSections((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore storage write failures (private mode, quota)
      }
      return next;
    });
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
          dashboardHref={dashboardHref}
        />
        <SidebarBrand />
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
              dashboardHref={dashboardHref}
              onNavigate={onCloseMobile}
            />
            <SidebarBrand />
          </aside>
        </div>
      )}
    </>
  );
}
