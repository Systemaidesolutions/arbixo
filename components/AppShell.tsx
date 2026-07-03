"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";
import { HelpWidget } from "@/components/HelpWidget";
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

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        user={user}
        onMenu={() => setMobileOpen(true)}
        headerLogo={branding?.headerLogo}
        companyName={companyName}
        userName={userName}
        hasPhoto={hasPhoto}
        hasCompanyLogo={hasCompanyLogo}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          role={role}
          subtype={subtype}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main
          className="relative flex-1 overflow-y-auto bg-gradient-to-b from-[#eef4fb] to-[#f7fafd]"
          style={
            branding?.background
              ? {
                  // A quarter-page decoration pinned to the bottom-right,
                  // not a full-cover background.
                  backgroundImage: "url(/api/branding/background)",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right bottom",
                  backgroundSize: "min(40%, 480px) auto",
                  backgroundAttachment: "fixed",
                }
              : undefined
          }
        >
          {!branding?.background && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/arbixo-icon.png"
                alt=""
                className="w-[520px] max-w-[80%] opacity-[0.06]"
              />
            </div>
          )}
          <div className="relative min-h-full">{children}</div>
        </main>
      </div>

      <Footer />
      <HelpWidget />
    </div>
  );
}
