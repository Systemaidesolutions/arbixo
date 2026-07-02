import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <Image
        src="/arbixo-logo.jpg"
        alt="Arbixo — Accounting Intelligence. Business Excellence."
        width={360}
        height={202}
        priority
        className="mb-8 h-auto w-full max-w-[280px]"
      />
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
