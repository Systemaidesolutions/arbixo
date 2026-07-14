import Image from "next/image";
import { brandingFlags } from "@/lib/branding";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await brandingFlags();

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0b3a8f] via-[#2563eb] to-[#60a5fa] px-4 py-12"
      style={
        branding.login
          ? {
              backgroundImage: "url(/api/branding/login)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {branding.login && <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/20" />}
      <div className="relative w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <Image
          src="/arbixo-logo.jpg"
          alt="Arbixo — Accounting Intelligence. Business Excellence."
          width={360}
          height={202}
          priority
          className="mx-auto mb-6 h-auto w-full max-w-[220px]"
        />
        {children}
      </div>
    </main>
  );
}
