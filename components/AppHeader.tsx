import Image from "next/image";
import { Menu } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import type { SessionPayload } from "@/lib/auth";

export function AppHeader({
  user,
  onMenu,
}: {
  user: SessionPayload | null;
  onMenu?: () => void;
}) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {/* Hamburger — only meaningful (and only shown) on small screens
            where the sidebar is an off-canvas drawer. */}
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className="-ml-1 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
          >
            <Menu size={20} />
          </button>
        )}

        <a href="/" className="flex items-center gap-2.5">
          <Image src="/arbixo-icon.png" alt="Arbixo" width={191} height={124} className="h-8 w-auto" priority />
          <span className="text-lg font-semibold tracking-tight text-brand-navy">
            ARBi
            <span className="bg-gradient-to-br from-brand-blue to-brand-green bg-clip-text text-transparent">
              x
            </span>
            o
          </span>
        </a>
        <span className="hidden text-xs text-neutral-400 md:inline">
          Accounting Intelligence. Business Excellence.
        </span>

        {user && (
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[40vw] truncate text-xs text-neutral-500 sm:inline">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        )}
      </div>
      <div className="h-[3px] w-full bg-gradient-to-r from-brand-navy via-brand-blue to-brand-green" />
    </header>
  );
}
