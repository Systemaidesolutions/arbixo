import { SimpleMarkdown, markdownSections } from "@/components/SimpleMarkdown";
import { PAYROLL_MANUAL_MD } from "@/lib/payroll/manual";

export const metadata = { title: "Payroll user manual" };

// In-app user manual for ARbixo Payroll (sidebar › Setup › User manual).
export default function PayrollManualPage() {
  const sections = markdownSections(PAYROLL_MANUAL_MD);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">ARbixo Payroll user manual</h1>
      <p className="mt-1 text-sm text-neutral-500">How to set up payroll, encode and post runs, manage leave and print payslips.</p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border border-neutral-200 bg-white/70 p-3">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Contents</div>
            <ul className="mt-2 space-y-1 text-sm">
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="text-brand-blue hover:underline">{s.title}</a></li>
              ))}
            </ul>
          </div>
        </nav>
        <article className="min-w-0 rounded-lg border border-neutral-200 bg-white/70 p-5 sm:p-6">
          <SimpleMarkdown source={PAYROLL_MANUAL_MD} />
        </article>
      </div>
    </main>
  );
}
