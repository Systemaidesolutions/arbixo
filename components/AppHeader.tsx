import Image from "next/image";
import { Menu, User, ChevronDown } from "lucide-react";
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
    <header className="shrink-0 bg-gradient-to-r from-brand-navyDark via-brand-navy to-[#0e3a63] text-white shadow-sm">
      {/* Bright accent line across the top */}
      <div className="h-[3px] w-full bg-gradient-to-r from-brand-blue to-brand-green" />

      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
        {/* Hamburger — only on small screens where the sidebar is a drawer */}
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className="-ml-1 rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Menu size={20} />
          </button>
        )}

        <a href="/" className="flex items-center gap-2.5">
          <Image src="/arbixo-icon.png" alt="Arbixo" width={191} height={124} className="h-8 w-auto" priority />
          <span className="text-lg font-semibold tracking-tight text-white">
            ARbi
            <span className="bg-gradient-to-br from-brand-blue to-brand-green bg-clip-text text-transparent">
              x
            </span>
            o
          </span>
        </a>
        <span className="hidden text-xs md:inline">
          <span className="text-white/70">Accounting Intelligence. </span>
          <span className="font-medium text-brand-green">Business Excellence.</span>
        </span>

        {user && (
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-[40vw] truncate text-sm text-white/80 sm:inline">
              {user.email}
            </span>
            <LogoutButton />
            <div className="flex items-center gap-1 border-l border-white/15 pl-2 sm:pl-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                <User size={16} className="text-white" />
              </span>
              <ChevronDown size={14} className="text-white/60" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
