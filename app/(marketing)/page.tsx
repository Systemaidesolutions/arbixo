import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Landmark,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";

const CONTACT_EMAIL = "info@arbixo.net";

const OFFERINGS = [
  {
    icon: ReceiptText,
    title: "Day-to-day transactions",
    body: "Cash receipts, sales and purchases on account, cash disbursements, importations and journal entries — each posted straight to your books with VAT and withholding computed for you.",
  },
  {
    icon: BarChart3,
    title: "Financial statements",
    body: "Trial balance, balance sheet, income statement, statement of changes in equity and cash flow — generated on demand, always tied to your posted entries.",
  },
  {
    icon: Landmark,
    title: "BIR-ready reporting",
    body: "VAT Return (2550Q), Expanded Withholding (1601-EQ), Certificates of Tax Withheld (2307), SLS/SLP/SLI, QAP and SAWT — including RELIEF .DAT files named for direct upload.",
  },
  {
    icon: BookOpen,
    title: "Books of accounts",
    body: "Cash receipts, cash disbursement and general journals, the general ledger book, and sales and purchase subsidiary journals — printable in the format your accountant expects.",
  },
  {
    icon: Building2,
    title: "Multi-branch and multi-company",
    body: "Run several companies from one login, tag every entry to a branch, and generate any report per branch or consolidated across all of them.",
  },
  {
    icon: Sparkles,
    title: "Ask ARbi",
    body: "Ask for a report in plain English — \"income statement for last quarter\" — and ARbi finds it, sets the period and opens it for you.",
  },
];

const WHY = [
  { icon: Upload, title: "Bring your data with you", body: "Import transactions from Excel or CSV, with a downloadable template for every transaction type." },
  { icon: FileSpreadsheet, title: "Everything exports", body: "Every report prints on A4 and exports to real Excel files — not CSV dumps — ready to send to your accountant or the BIR." },
  { icon: ShieldCheck, title: "Auditable by design", body: "A full audit trail, per-transaction attachments, user roles with approval controls, and backups of your company data." },
];

const FAQ = [
  {
    q: "What exactly is ARbixo?",
    a: "ARbixo is a cloud accounting system built specifically for Philippine businesses. You record your day-to-day transactions, and it maintains your books of accounts, financial statements and BIR reports automatically — no spreadsheets to reconcile at the end of the month.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. ARbixo runs in your web browser, so it works on a laptop, tablet or phone with nothing to install and nothing to update. Your data is stored securely in the cloud and is available wherever you sign in.",
  },
  {
    q: "Can I file my BIR returns directly from ARbixo?",
    a: "ARbixo prepares the figures and generates the forms and RELIEF .DAT files you need — 2550Q, 1601-EQ, 2307, SLS/SLP/SLI, QAP and SAWT — with the correct BIR upload filenames. The actual filing is still done through eFPS or eBIRForms, and we always recommend reviewing the figures with your accountant before submitting.",
  },
  {
    q: "Can I use ARbixo for more than one company or branch?",
    a: "Yes. You can manage multiple companies, and every transaction can be tagged to a branch. Reports can then be generated for a single branch or consolidated across the whole business.",
  },
  {
    q: "Can I move my existing records into ARbixo?",
    a: "Yes. Every transaction type supports importing from Excel or CSV, and each screen provides a template so your existing data can be mapped and uploaded in bulk.",
  },
  {
    q: "Is my data safe?",
    a: "Your data is encrypted in transit, access is controlled by user roles and approval permissions, and every change is recorded in an audit trail. Company backups are available so your records are never tied to a single device.",
  },
  {
    q: "How do I get started?",
    a: `Email us at ${CONTACT_EMAIL} and we'll set up your company, walk you through the system and help you bring your existing records across.`,
  },
];

export default async function LandingPage() {
  // Signed-in visitors go straight to their dashboard.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const navLink = "text-sm font-medium text-neutral-600 transition-colors hover:text-brand-navy";
  const section = "mx-auto w-full max-w-6xl px-5 sm:px-8";

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className={`${section} flex items-center justify-between gap-4 py-3`}>
          <a href="#top" className="flex items-center">
            <Image
              src="/arbixo-wordmark.png"
              alt="ARbixo"
              width={1600}
              height={896}
              priority
              className="h-auto w-[130px] sm:w-[150px]"
            />
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#offerings" className={navLink}>What we offer</a>
            <a href="#about" className={navLink}>About</a>
            <a href="#faq" className={navLink}>FAQ</a>
            <a href="#contact" className={navLink}>Contact</a>
          </nav>
          <a
            href="/login"
            className="shrink-0 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-navyLight"
          >
            Log in
          </a>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-br from-brand-navyDark via-brand-navy to-[#0e3a63]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-blue/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-green/20 blur-3xl"
        />
        <div className={`${section} relative py-20 sm:py-28`}>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 ring-1 ring-white/20">
              For Philippine businesses
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
              Accounting Intelligence.
              <br />
              <span className="bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">
                Business Excellence.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">
              ARbixo keeps your books, financial statements and BIR reports in one place — accurate,
              up to date, and ready when you need them. Record your transactions; we&apos;ll handle
              the ledgers, the VAT, the withholding and the filing files.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=ARbixo%20enquiry`}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Get in touch <ArrowRight size={16} />
              </a>
              <a
                href="#offerings"
                className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10"
              >
                See what we offer
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Offerings */}
      <section id="offerings" className="scroll-mt-20 bg-neutral-50 py-20">
        <div className={section}>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-brand-navy">What we offer</h2>
            <p className="mt-3 text-neutral-600">
              One system that carries a transaction from the moment you record it all the way
              through to the reports you file.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {OFFERINGS.map((o) => (
              <div
                key={o.title}
                className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
                  <o.icon size={22} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-neutral-900">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{o.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="flex gap-4 rounded-xl bg-white p-5 ring-1 ring-neutral-200">
                <span className="mt-0.5 shrink-0 text-brand-green">
                  <w.icon size={20} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">{w.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{w.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 py-20">
        <div className={`${section} grid items-center gap-12 lg:grid-cols-2`}>
          <div>
            <h2 className="text-3xl font-bold text-brand-navy">About ARbixo</h2>
            <p className="mt-4 leading-relaxed text-neutral-600">
              ARbixo is built and supported by <strong className="text-neutral-900">Systemaide Solutions Inc.</strong>,
              for businesses that need their accounting to hold up to Philippine compliance without
              hiring a bigger team to keep it that way.
            </p>
            <p className="mt-4 leading-relaxed text-neutral-600">
              Most accounting tools are built somewhere else and adapted here afterwards. ARbixo was
              designed the other way round — around BIR forms, ATC withholding codes, RELIEF files
              and the books of accounts your examiner will actually ask for. The result is a system
              your bookkeeper can use every day and your accountant can trust at year end.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Built around Philippine tax and reporting requirements",
                "Designed for real bookkeeping workflows, not just record-keeping",
                "Supported by a local team you can actually reach",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-neutral-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-green" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-brand-navy to-[#0e3a63] p-8 text-white shadow-xl">
            <p className="text-sm uppercase tracking-wide text-white/60">Our promise</p>
            <p className="mt-3 text-2xl font-semibold leading-snug">
              Your books, always ready — for management, for your accountant, and for the BIR.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/15 pt-6 text-center">
              {[
                { k: "BIR", v: "Ready" },
                { k: "Cloud", v: "Anywhere" },
                { k: "Local", v: "Support" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="text-lg font-bold text-brand-green">{s.v}</div>
                  <div className="text-xs uppercase tracking-wide text-white/50">{s.k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-neutral-50 py-20">
        <div className={`${section} max-w-3xl`}>
          <h2 className="text-3xl font-bold text-brand-navy">Frequently asked questions</h2>
          <p className="mt-3 text-neutral-600">
            Can&apos;t find what you&apos;re looking for? Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-blue hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <div className="mt-8 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-neutral-900 marker:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-xl font-normal leading-none text-brand-blue transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-sm leading-relaxed text-neutral-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 py-20">
        <div className={section}>
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navyDark via-brand-navy to-[#0e3a63] px-8 py-14 text-center shadow-xl sm:px-14">
            <h2 className="text-3xl font-bold text-white">Let&apos;s talk about your books</h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-white/75">
              Tell us about your business and we&apos;ll show you how ARbixo fits — including moving
              your existing records across.
            </p>

            <a
              href={`mailto:${CONTACT_EMAIL}?subject=ARbixo%20enquiry`}
              className="mx-auto mt-8 inline-flex items-center gap-3 rounded-xl bg-white px-6 py-4 text-base font-semibold text-brand-navy shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <Mail size={20} className="text-brand-green" />
              {CONTACT_EMAIL}
            </a>

            <p className="mt-6 text-sm text-white/60">
              We usually reply within one business day.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className={`${section} flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left`}>
          <Image
            src="/login-footer-logo.png"
            alt="Accounting Intelligence. Business Excellence. Powered by: Systemaide Solutions Inc."
            width={1598}
            height={145}
            className="h-auto w-[240px]"
          />
          <div className="text-xs text-neutral-500">
            <p>
              &copy; {new Date().getFullYear()} Systemaide Solutions Inc. All rights reserved.
            </p>
            <p className="mt-1">
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-brand-navy">{CONTACT_EMAIL}</a>
              <span className="mx-2 text-neutral-300">|</span>
              <a href="/login" className="hover:text-brand-navy">Log in</a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
