import Image from "next/image";
import { brandingFlags } from "@/lib/branding";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await brandingFlags();

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12"
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
      <div className="relative w-full max-w-sm rounded-2xl bg-[#123A73] p-8 shadow-[0_25px_60px_-15px_rgba(11,42,95,0.55)] ring-1 ring-white/10">
        <div className="mx-auto mb-6 flex w-fit justify-center rounded-xl bg-white p-3 shadow-sm">
          <Image
            src="/arbixo-logo.jpg"
            alt="Arbixo — Accounting Intelligence. Business Excellence."
            width={360}
            height={202}
            priority
            className="h-auto w-[280px] max-w-full"
          />
        </div>
        {children}
      </div>
    </main>
  );
}
