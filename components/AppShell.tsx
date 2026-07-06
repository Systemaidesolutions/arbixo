"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";
import { HelpWidget } from "@/components/HelpWidget";
import { PageStackProvider, PageStackOverlay, BaseLinkInterceptor, EmbedLinkInterceptor } from "@/components/PageStack";
import type { SessionPayload } from "@/lib/auth";
import type { SubscriberSubtype } from "@prisma/client";
import type { BrandingFlags } from "@/lib/branding";

/**
 * App shell: fixed-height layout with a dark header on top, a dark docked
 * sidebar + scrollable light content in the middle, and a full-width
 * footer at the bottom. Owns the mobile-drawer open/close state.
 */
export function AppShell({
  user,
  role,
  subtype = null,
  branding,
  companyName = null,
  userName = null,
  hasPhoto = false,
  hasCompanyLogo = false,
  children,
}: {
  user: SessionPayload | null;
  role: "ADMIN" | "USER";
  subtype?: SubscriberSubtype | null;
  branding?: BrandingFlags;
  companyName?: string | null;
  userName?: string | null;
  hasPhoto?: boolean;
  hasCompanyLogo?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // When a page is opened inside the stack it loads with ?_embed=1 — render it
  // chrome-less (no header/sidebar/footer) so only its content shows in the
  // overlay, and intercept its links so they open deeper on the parent's stack.
  const embedded = useSearchParams().get("_embed") === "1";

  if (embedded) {
    return (
      <div className="min-h-screen">
        <EmbedLinkInterceptor />
        {children}
      </div>
    );
  }

  return (
    <PageStackProvider>
    <div className="flex h-screen flex-col">
      {/* Fixed page background — stays in place while content scrolls. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#eef4fb] to-[#f7fafd]"
      >
        {branding?.background ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/api/branding/background)",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right bottom",
              backgroundSize: "min(40%, 480px) auto",
            }}
          />
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/arbixo-icon.png" alt="" className="w-[520px] max-w-[80%] opacity-[0.06]" />
          </div>
        )}
      </div>

      <AppHeader
        user={user}
        onMenu={() => setMobileOpen(true)}
        companyName={companyName}
        userName={userName}
        hasPhoto={hasPhoto}
        hasCompanyLogo={hasCompanyLogo}
      />

      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          role={role}
          subtype={subtype}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main className="relative flex-1 overflow-y-auto">
          <div className="relative min-h-full">{children}</div>
        </main>

        {/* Anchored to the content region (above the footer) so the button
            never covers the footer links. */}
        <HelpWidget />

        {/* Stacked page overlays — live inside this content row so they sit
            below the header, above the footer, and right of the sidebar. */}
        <PageStackOverlay />
        <BaseLinkInterceptor />
      </div>

      <Footer />
    </div>
    </PageStackProvider>
  );
}
