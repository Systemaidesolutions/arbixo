import Image from "next/image";
import { redirect } from "next/navigation";
import { BookText, Banknote, ArrowRight } from "lucide-react";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { getAdminActingAsCompanyId } from "@/lib/adminActingAs";
import { brandingFlags } from "@/lib/branding";
import { userApps } from "@/lib/appAccess";
import { LogoutButton } from "@/components/LogoutButton";

// App launcher shown after login: ARbixo Accounting and ARbixo Payroll share
// one account, and the user picks which one to open. /apps/open remembers the
// choice (APP_COOKIE) and sends them to that app's home page.
const APPS = [
  {
    key: "accounting",
    name: "Accounting",
    icon: BookText,
    blurb: "Transactions, books of accounts, financial statements and BIR reports.",
    accent: "from-brand-blue to-[#1668c9]",
  },
  {
    key: "payroll",
    name: "Payroll",
    icon: Banknote,
    blurb: "Employees, daily and monthly payroll runs, payslips and statutory deductions.",
    accent: "from-brand-green to-[#2a9467]",
  },
] as const;

export default async function AppsPage() {
  const [user, branding] = await Promise.all([getCurrentUserRecord(), brandingFlags()]);
  if (!user || user.isDisabled) redirect("/login");
  // Platform admins manage ARbixo itself, not a company's books or payroll.
  if (user.role === "ADMIN" && !getAdminActingAsCompanyId()) redirect("/dashboard");
  // Only the apps assigned to this user; with just one, open it directly.
  const allowed = userApps(user);
  const apps = APPS.filter((a) => (allowed as string[]).includes(a.key));
  if (apps.length === 1) redirect(`/apps/open?app=${apps[0].key}`);

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#eef4fb] to-[#f7fafd] px-4 py-12"
      style={branding.login ? { backgroundImage: "url(/api/branding/login)", backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {branding.login && <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/20" />}
      <div className="relative w-full max-w-3xl">
        <div className="mx-auto mb-6 flex w-fit justify-center rounded-xl bg-white p-3 shadow-sm">
          <Image src="/arbixo-wordmark.png" alt="ARbixo" width={1600} height={896} priority className="h-auto max-w-full" style={{ width: 220 }} />
        </div>
        <div className="rounded-2xl bg-[#123A73] p-6 shadow-[0_25px_60px_-15px_rgba(11,42,95,0.55)] ring-1 ring-white/10 sm:p-8">
          <h1 className="text-center text-lg font-medium text-white">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}. Which app do you want to open?</h1>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {apps.map((a) => (
              <a
                key={a.key}
                href={`/apps/open?app=${a.key}`}
                className="group flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${a.accent} text-white shadow-sm`}>
                  <a.icon size={24} />
                </span>
                <span className="mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">ARbixo</span>
                <span className="text-xl font-semibold text-brand-navy">{a.name}</span>
                <span className="mt-1 flex-1 text-sm text-neutral-600">{a.blurb}</span>
                <span className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-blue group-hover:gap-2">
                  Open {a.name} <ArrowRight size={16} className="transition-all" />
                </span>
              </a>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between text-sm text-blue-100">
            <span className="truncate">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
