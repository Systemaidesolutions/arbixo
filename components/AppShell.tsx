"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";
import type { SessionPayload } from "@/lib/auth";

/**
 * App shell: fixed-height layout with a dark header on top, a dark docked
 * sidebar + scrollable light content in the middle, and a full-width
 * footer at the bottom. Owns the mobile-drawer open/close state.
 */
export function AppShell({
  user,
  role,
  children,
}: {
  user: SessionPayload | null;
  role: "ADMIN" | "USER";
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader user={user} onMenu={() => setMobileOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <Sidebar role={role} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

        <main className="relative flex-1 overflow-y-auto bg-gradient-to-b from-[#eef4fb] to-[#f7fafd]">
          {/* Faint brand watermark behind the content */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/arbixo-icon.png"
              alt=""
              className="mt-12 w-[440px] max-w-[70%] opacity-[0.04]"
            />
          </div>
          <div className="relative min-h-full">{children}</div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
