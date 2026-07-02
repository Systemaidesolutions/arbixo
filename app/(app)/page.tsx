import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentCompany, getCurrentUserRecord } from "@/lib/currentUser";

export default async function HomePage() {
  const user = await getCurrentUserRecord();
  if (user?.role === "ADMIN") {
    redirect("/admin");
  }

  const company = await getCurrentCompany();

  return (
    <main className="mx-auto max-w-2xl px-8 py-12">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/arbixo-logo.jpg"
          alt="Arbixo — Accounting Intelligence. Business Excellence. Powered by Systemaide Solutions Inc."
          width={480}
          height={269}
          priority
          className="h-auto w-full max-w-sm"
        />
      </div>

      <div className="mx-auto mt-10">
        {!company ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-sm text-amber-900">
              No company is set up in this instance yet — start here before anything else will
              work.
            </p>
            <a
              href="/company/setup"
              className="mt-3 inline-block rounded bg-[#0B2A5E] px-4 py-2 text-sm text-white hover:bg-[#123A73]"
            >
              Set up company
            </a>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Company
            </div>
            <div className="mt-1 text-lg font-medium text-brand-navy">{company.tradeName}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-600">
              <dt className="text-neutral-400">TIN</dt>
              <dd className="font-mono">{company.tin}</dd>
              <dt className="text-neutral-400">Registration</dt>
              <dd>{company.registrationType === "VAT" ? "VAT Registered" : "Non-VAT Registered"}</dd>
              <dt className="text-neutral-400">Address</dt>
              <dd>{company.businessAddress}</dd>
              <dt className="text-neutral-400">RDO</dt>
              <dd>{company.rdoCode}</dd>
            </dl>
            <a href="/company/setup" className="mt-3 inline-block text-xs text-brand-blue hover:underline">
              Edit company details →
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
