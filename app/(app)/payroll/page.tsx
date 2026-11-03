import Link from "next/link";
import { getCurrentCompany } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatPeso } from "@/lib/format";
import { getOrCreateSetup, isoDate } from "@/lib/payroll/server";

const mdy = (d: Date) => { const [y, m, dd] = isoDate(d).split("-"); return `${m}/${dd}/${y}`; };
const STATUS_BADGE = { DRAFT: "bg-amber-100 text-amber-700", POSTED: "bg-green-100 text-green-700", CANCELLED: "bg-neutral-100 text-neutral-500" };

// Home page of the Payroll app (the sidebar's Dashboard button while in Payroll).
export default async function PayrollHomePage() {
  const company = await getCurrentCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Payroll</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const setup = await getOrCreateSetup(company.id);
  const in30 = new Date(Date.now() + 30 * 86400000);
  const [profiles, unassigned, drafts, recent, ending, postedThisYear] = await Promise.all([
    prisma.payrollProfile.groupBy({ by: ["payBasis"], where: { companyId: company.id, isActive: true, employee: { isActive: true } }, _count: true }),
    prisma.employee.count({ where: { companyId: company.id, isActive: true, payrollProfile: null } }),
    prisma.payrollRun.count({ where: { companyId: company.id, status: "DRAFT" } }),
    prisma.payrollRun.findMany({ where: { companyId: company.id }, include: { payGroup: true }, orderBy: [{ payDate: "desc" }, { runNo: "desc" }], take: 6 }),
    prisma.payrollProfile.findMany({
      where: { companyId: company.id, isActive: true, contractEnd: { gte: new Date(new Date().toDateString()), lte: in30 } },
      include: { employee: { select: { lastName: true, firstName: true, code: true } } },
      orderBy: { contractEnd: "asc" },
    }),
    prisma.payrollRun.aggregate({
      where: { companyId: company.id, status: "POSTED", payDate: { gte: new Date(Date.UTC(new Date().getFullYear(), 0, 1)) } },
      _sum: { totalGross: true, totalNet: true },
    }),
  ]);
  const count = (b: "DAILY" | "MONTHLY") => profiles.find((p) => p.payBasis === b)?._count ?? 0;
  const accountsMissing = !setup.salariesExpenseAccountId || !setup.netPayAccountId || !setup.sssPayableAccountId;

  const tiles: [string, string, string?][] = [
    ["Daily-rate employees", String(count("DAILY")), "/payroll/employees"],
    ["Monthly-paid employees", String(count("MONTHLY")), "/payroll/employees"],
    ["Draft runs", String(drafts), "/payroll/runs"],
    [`Gross paid ${new Date().getFullYear()}`, formatPeso(Number(postedThisYear._sum.totalGross ?? 0))],
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-neutral-900">Payroll</h1>
          <p className="mt-1 text-sm text-neutral-500">{company.registeredName || company.tradeName}</p>
        </div>
        <Link href="/payroll/runs" className="rounded bg-brand-navy px-3 py-1.5 text-sm text-white hover:bg-brand-navyLight">+ New payroll run</Link>
      </div>

      {(accountsMissing || unassigned > 0) && (
        <div className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {accountsMissing && <p>Posting accounts aren&apos;t set yet. <Link href="/payroll/setup" className="font-medium underline">Open Payroll setup</Link> before posting a run.</p>}
          {unassigned > 0 && <p>{unassigned} active employee(s) have no pay details yet. <Link href="/payroll/employees" className="font-medium underline">Set them up</Link>.</p>}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([k, v, href]) => {
          const body = <><div className="text-[11px] uppercase tracking-wide text-neutral-500">{k}</div><div className="mt-1 font-mono text-2xl text-neutral-900">{v}</div></>;
          return href
            ? <Link key={k} href={href} className="rounded-lg border border-neutral-200 bg-white/70 px-4 py-3 hover:border-brand-blue/40">{body}</Link>
            : <div key={k} className="rounded-lg border border-neutral-200 bg-white/70 px-4 py-3">{body}</div>;
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-neutral-200 bg-white/70 p-4 lg:col-span-2">
          <h2 className="text-sm font-medium text-neutral-800">Recent payroll runs</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-neutral-100">
              {recent.length === 0 && <tr><td className="py-3 text-neutral-400">No runs yet.</td></tr>}
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-3 font-mono text-xs"><Link href={`/payroll/runs/${r.id}`} className="text-brand-blue hover:underline">{r.runNo}</Link></td>
                  <td className="py-1.5 pr-3">{r.payGroup.name}</td>
                  <td className="py-1.5 pr-3 text-xs text-neutral-500">{mdy(r.periodStart)} – {mdy(r.periodEnd)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{formatPeso(Number(r.totalNet))}</td>
                  <td className="py-1.5 text-right"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-lg border border-neutral-200 bg-white/70 p-4">
          <h2 className="text-sm font-medium text-neutral-800">Contracts ending in 30 days</h2>
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {ending.length === 0 && <li className="py-2 text-neutral-400">None.</li>}
            {ending.map((p) => (
              <li key={p.id} className="flex justify-between py-1.5">
                <span>{p.employee.lastName}, {p.employee.firstName}</span>
                <span className="text-xs text-neutral-500">{p.contractEnd ? mdy(p.contractEnd) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
