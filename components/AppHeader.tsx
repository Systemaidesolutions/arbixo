import Image from "next/image";
import { LogoutButton } from "@/components/LogoutButton";
import type { SessionPayload } from "@/lib/auth";

export function AppHeader({ user }: { user: SessionPayload | null }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-8 py-3">
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
        <span className="hidden text-xs text-neutral-400 sm:inline">
          Accounting Intelligence. Business Excellence.
        </span>

        {user && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-neutral-500">{user.email}</span>
            <LogoutButton />
          </div>
        )}
      </div>
      <div className="h-[3px] w-full bg-gradient-to-r from-brand-navy via-brand-blue to-brand-green" />
    </header>
  );
}
