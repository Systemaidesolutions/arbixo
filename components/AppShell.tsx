"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";
import type { SessionPayload } from "@/lib/auth";

/**
 * Client shell that owns the mobile-drawer open/close state and wires the
 * header's hamburger to the sidebar. The layout stays a server component
 * (it does the auth/disabled check); this just handles interactivity.
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
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <AppHeader user={user} onMenu={() => setMobileOpen(true)} />
      <div className="flex flex-1 items-start">
        <Sidebar role={role} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
